-- Bridge module for Lua <-> JavaScript communication (Love.js)
local Bridge = {}

Bridge.walletConnected = false
Bridge.walletAddress = nil
Bridge.characterSeed = nil
Bridge.roundId = nil
Bridge.poolBalance = 0
Bridge.endTimestamp = 0
Bridge.chatMessages = {}
Bridge.ticketId = nil
Bridge.leaderboard = {}

-- v21: Init state tracking for delayed initialization
Bridge.initApplied = false      -- True once we've applied init state
Bridge.needsInitPoll = false    -- True if we need to poll for init file
Bridge.needsStateTransition = false  -- True when main.lua should transition to LOUNGE

-- Round state management
Bridge.GRACE_PERIOD = 5 * 60 * 1000  -- 5 minutes in ms

-- Player stats
Bridge.playerStats = {
    gamesPlayed = 0,
    bestTime = 0,  -- in milliseconds
    totalSpent = 0,  -- in SUI
}

-- Past round winners
Bridge.pastRounds = {}  -- Array of {roundId, endTime, winners: [{rank, address, survivalTime}]}

-- Online players in Sauna
Bridge.onlinePlayers = {}  -- Array of {id, address, characterSeed, x, y}

-- Queue for outgoing messages
Bridge.outQueue = {}

-- Browser detection (set in init() after runtime is ready)
Bridge.isBrowser = nil

-- Parse initial state JSON from bridge_init.json
-- Format: {"connected":true,"address":"0x...","characterSeed":123456}
function Bridge.parseInitJSON(str)
    if not str or str == "" then return nil end

    local data = {}

    -- Extract connected (boolean)
    local connected = str:match('"connected":(%w+)')
    if connected then
        data.connected = (connected == "true")
    end

    -- Extract address (string or null)
    local address = str:match('"address":"([^"]*)"')
    if address and address ~= "" then
        data.address = address
    else
        -- Check for null
        local nullCheck = str:match('"address":null')
        if nullCheck then
            data.address = nil
        end
    end

    -- Extract characterSeed (number)
    local seed = str:match('"characterSeed":(%d+)')
    if seed then
        data.characterSeed = tonumber(seed)
    end

    return data
end

-- v21: Read init file with proper return value handling
-- love.filesystem.read() returns (contents, size) or (nil, errorMsg)
function Bridge.readInitFile()
    -- Try with leading slash first (absolute path in Emscripten FS)
    local contents, sizeOrError = love.filesystem.read("/bridge_init.json")
    if contents and type(contents) == "string" and contents ~= "" then
        print("[Bridge v21] Read /bridge_init.json: " .. string.sub(contents, 1, 50))
        return contents
    end

    -- Try without leading slash (relative to save directory)
    contents, sizeOrError = love.filesystem.read("bridge_init.json")
    if contents and type(contents) == "string" and contents ~= "" then
        print("[Bridge v21] Read bridge_init.json: " .. string.sub(contents, 1, 50))
        return contents
    end

    return nil
end

-- v22: Read initial state directly from JavaScript global
-- This bypasses the broken Emscripten FS bridge entirely
function Bridge.readFromJSGlobal()
    if not Bridge.isBrowser then
        print("[Bridge v22] Not in browser, skipping JS global read")
        return nil
    end

    if type(js) ~= "table" then
        print("[Bridge v22] js global not available (type=" .. type(js) .. ")")
        return nil
    end

    if not js.global then
        print("[Bridge v22] js.global not available")
        return nil
    end

    -- Try to access window.INITIAL_WALLET_STATE
    local success, result = pcall(function()
        local state = js.global.INITIAL_WALLET_STATE
        if state then
            print("[Bridge v22] Found INITIAL_WALLET_STATE object")
            -- Access properties safely - they come as JS values
            local connected = state.connected
            local address = state.address
            local characterSeed = state.characterSeed

            return {
                connected = connected,
                address = address,
                characterSeed = characterSeed
            }
        end
        print("[Bridge v22] INITIAL_WALLET_STATE is nil or undefined")
        return nil
    end)

    if success and result then
        print("[Bridge v22] Successfully read from js.global:")
        print("[Bridge v22]   connected: " .. tostring(result.connected))
        print("[Bridge v22]   address: " .. tostring(result.address))
        print("[Bridge v22]   characterSeed: " .. tostring(result.characterSeed))
        return result
    else
        print("[Bridge v22] Failed to read INITIAL_WALLET_STATE: " .. tostring(result))
        return nil
    end
end

-- v21: Apply parsed init state and set transition flags
function Bridge.applyInitState(content)
    local data = Bridge.parseInitJSON(content)
    if data then
        print("[Bridge v21] Applying init state:")
        print("[Bridge v21]   connected: " .. tostring(data.connected))
        print("[Bridge v21]   address: " .. tostring(data.address))
        print("[Bridge v21]   characterSeed: " .. tostring(data.characterSeed))

        Bridge.walletConnected = data.connected == true
        Bridge.walletAddress = data.address
        if data.characterSeed then
            Bridge.characterSeed = data.characterSeed
        end
        Bridge.initApplied = true
        Bridge.needsStateTransition = true
        return true
    else
        print("[Bridge v21] Failed to parse init file content")
        return false
    end
end

-- v22: Poll for init state (called every frame until found)
function Bridge.pollInitFile()
    if not Bridge.needsInitPoll then return end
    if Bridge.initApplied then
        Bridge.needsInitPoll = false
        return
    end

    -- v22: Try JS global first (most reliable)
    local jsState = Bridge.readFromJSGlobal()
    if jsState then
        Bridge.walletConnected = jsState.connected == true
        Bridge.walletAddress = jsState.address
        if jsState.characterSeed then
            Bridge.characterSeed = jsState.characterSeed
        end
        Bridge.initApplied = true
        Bridge.needsStateTransition = true
        Bridge.needsInitPoll = false
        print("[Bridge v22] Init via polling from JS global successful!")
        return
    end

    -- Fallback: Try filesystem (probably won't work)
    local initContent = Bridge.readInitFile()
    if initContent then
        if Bridge.applyInitState(initContent) then
            Bridge.needsInitPoll = false
            print("[Bridge v22] Init file found via polling")
        end
    end
end

function Bridge.init()
    print("[Bridge v22] init() starting...")

    -- Detect browser environment (Love.js) - must be done after runtime init
    local detectedOS = love.system.getOS()
    print("[Bridge v22] OS detected: " .. tostring(detectedOS))

    -- Check for js global first (more reliable in Love.js)
    Bridge.isBrowser = (type(js) == "table" and js.global ~= nil)
    if not Bridge.isBrowser then
        -- Fallback to OS check
        Bridge.isBrowser = (detectedOS == "Web")
    end
    print("[Bridge v22] isBrowser = " .. tostring(Bridge.isBrowser))

    -- ===== V22: Try reading from JS global first (most reliable) =====
    -- This bypasses the broken Emscripten FS entirely
    print("[Bridge v22] Attempting to read from js.global.INITIAL_WALLET_STATE...")

    local jsState = Bridge.readFromJSGlobal()
    if jsState then
        Bridge.walletConnected = jsState.connected == true
        Bridge.walletAddress = jsState.address
        if jsState.characterSeed then
            Bridge.characterSeed = jsState.characterSeed
        end
        Bridge.initApplied = true
        print("[Bridge v22] Init from JS global successful!")
    else
        -- Fallback: Try filesystem (probably won't work, but try anyway)
        print("[Bridge v22] JS global failed, trying filesystem fallback...")
        local initContent = Bridge.readInitFile()
        if initContent then
            Bridge.applyInitState(initContent)
        else
            print("[Bridge v22] All init methods failed, will poll in update()")
            Bridge.needsInitPoll = true
        end
    end

    -- Debug: Log filesystem paths for bridge setup
    if Bridge.isBrowser then
        local saveDir = love.filesystem.getSaveDirectory()
        local sourceDir = love.filesystem.getSource()
        local identity = love.filesystem.getIdentity()
        print("[Bridge v22] Save directory: " .. tostring(saveDir))
        print("[Bridge v22] Source directory: " .. tostring(sourceDir))
        print("[Bridge v22] Identity: " .. tostring(identity))
    end

    -- Set up global functions for JS to call (legacy, may not work in all Love.js builds)
    if Bridge.isBrowser and type(js) == "table" and js.global then
        -- Expose Lua functions to JavaScript
        js.global.luaBridge = {
            setWalletState = function(connected, address)
                Bridge.walletConnected = connected
                Bridge.walletAddress = address
            end,
            setGameData = function(seed, roundId, ticketId)
                Bridge.characterSeed = tonumber(seed)
                Bridge.roundId = tonumber(roundId)
                Bridge.ticketId = ticketId
            end,
            setPoolData = function(balance, endTimestamp)
                Bridge.poolBalance = tonumber(balance) or 0
                Bridge.endTimestamp = tonumber(endTimestamp) or 0
            end,
            addChatMessage = function(sender, message, timestamp)
                table.insert(Bridge.chatMessages, {
                    sender = sender,
                    message = message,
                    timestamp = timestamp or os.time()
                })
                -- Keep only last 50 messages
                while #Bridge.chatMessages > 50 do
                    table.remove(Bridge.chatMessages, 1)
                end
            end,
            setLeaderboard = function(jsonData)
                -- Parse JSON leaderboard data
                local success, data = pcall(function()
                    return Bridge.parseJSON(jsonData)
                end)
                if success and data then
                    Bridge.leaderboard = data
                end
            end,
            setPlayerStats = function(gamesPlayed, bestTime, totalSpent)
                Bridge.playerStats.gamesPlayed = tonumber(gamesPlayed) or 0
                Bridge.playerStats.bestTime = tonumber(bestTime) or 0
                Bridge.playerStats.totalSpent = tonumber(totalSpent) or 0
            end,
            setPastRounds = function(jsonData)
                -- Parse JSON past rounds data
                local success, data = pcall(function()
                    return Bridge.parsePastRoundsJSON(jsonData)
                end)
                if success and data then
                    Bridge.pastRounds = data
                end
            end,
            setOnlinePlayers = function(jsonData)
                -- Parse JSON online players data
                local success, data = pcall(function()
                    return Bridge.parseOnlinePlayersJSON(jsonData)
                end)
                if success and data then
                    Bridge.onlinePlayers = data
                end
            end,
            startGame = function()
                love.event.push("startgame")
            end
        }
    end

    print("[Bridge v22] init() complete - walletConnected=" .. tostring(Bridge.walletConnected) .. ", initApplied=" .. tostring(Bridge.initApplied))
end

-- Poll for pending messages from JavaScript (called every frame)
-- Uses Emscripten filesystem as bridge since js global doesn't exist in Love.js
function Bridge.pollMessages()
    if not Bridge.isBrowser then
        -- Only warn once to avoid console spam
        if not Bridge._warnedNotBrowser then
            print("[Bridge] WARNING: pollMessages skipped - isBrowser is false")
            Bridge._warnedNotBrowser = true
        end
        return
    end

    -- DEBUG: Log once to confirm we're polling
    if not Bridge._loggedPolling then
        print("[Bridge] pollMessages: Using filesystem bridge (js global not available)")
        Bridge._loggedPolling = true
    end

    -- Read from filesystem bridge file
    local content = nil
    local success, data = pcall(function()
        return love.filesystem.read("bridge_inbox.txt")
    end)

    -- Check if we got valid string data
    if success and data and type(data) == "string" and data ~= "" then
        content = data
        -- Clear the file after reading
        pcall(function()
            love.filesystem.write("bridge_inbox.txt", "")
        end)
    end

    -- Exit early if no content
    if not content or type(content) ~= "string" or content == "" then
        return
    end

    -- Debug: Log received content (safe now that we verified it's a string)
    print("[Bridge] Read from filesystem: " .. string.sub(tostring(content), 1, 200))

    -- Parse the JSON message
    local msg = Bridge.parseFilesystemMessage(content)
    if msg then
        Bridge.handleMessage(msg)
    end
end

-- Parse a single JSON message from the filesystem bridge
function Bridge.parseFilesystemMessage(json)
    if not json or json == "" then return nil end

    local msg = { event = nil, data = {} }

    -- Extract event type
    msg.event = json:match('"event":"([^"]+)"')
    if not msg.event then return nil end

    -- Parse data based on event type
    if msg.event == "walletState" then
        local connected = json:match('"connected":(%w+)')
        msg.data.connected = (connected == "true")
        msg.data.address = json:match('"address":"([^"]*)"')
    end

    return msg
end

-- Parse message queue JSON: [{event:"x",data:{...}}, ...]
function Bridge.parseMessages(json)
    if not json or json == "" or json == "[]" then return nil end

    local messages = {}

    -- Match each message object: {"event":"xxx","data":{...}}
    for msgStr in json:gmatch('%{"event":"([^"]+)","data":(%b{})%}') do
        -- This pattern doesn't quite work, let's try a different approach
    end

    -- Simpler approach: split by },{ and parse each
    -- Remove outer brackets
    local inner = json:match('^%[(.*)%]$')
    if not inner or inner == "" then return nil end

    -- For each message block
    for msgBlock in (inner .. ","):gmatch('(%b{}),?') do
        local event = msgBlock:match('"event":"([^"]+)"')
        if event then
            local msg = { event = event, data = {} }

            -- Parse data based on event type
            if event == "walletState" then
                local connected = msgBlock:match('"connected":(%w+)')
                msg.data.connected = (connected == "true")
                msg.data.address = msgBlock:match('"address":"([^"]*)"')
            elseif event == "chatMessage" then
                msg.data.sender = msgBlock:match('"sender":"([^"]*)"')
                msg.data.message = msgBlock:match('"message":"([^"]*)"')
                local ts = msgBlock:match('"timestamp":(%d+)')
                msg.data.timestamp = ts and tonumber(ts) or os.time()
            elseif event == "poolData" then
                local balance = msgBlock:match('"balance":([%d%.]+)')
                local endTs = msgBlock:match('"endTimestamp":(%d+)')
                msg.data.balance = balance and tonumber(balance) or 0
                msg.data.endTimestamp = endTs and tonumber(endTs) or 0
            elseif event == "gameData" then
                local seed = msgBlock:match('"characterSeed":(%d+)')
                local roundId = msgBlock:match('"roundId":(%d+)')
                msg.data.characterSeed = seed and tonumber(seed)
                msg.data.roundId = roundId and tonumber(roundId)
                msg.data.ticketId = msgBlock:match('"ticketId":"([^"]*)"')
            elseif event == "playerStats" then
                local gp = msgBlock:match('"gamesPlayed":(%d+)')
                local bt = msgBlock:match('"bestTime":(%d+)')
                local ts = msgBlock:match('"totalSpent":([%d%.]+)')
                msg.data.gamesPlayed = gp and tonumber(gp) or 0
                msg.data.bestTime = bt and tonumber(bt) or 0
                msg.data.totalSpent = ts and tonumber(ts) or 0
            elseif event == "leaderboard" then
                -- Leaderboard data is nested, extract and re-parse
                local leaderData = msgBlock:match('"data":(%[.-%])')
                if leaderData then
                    msg.data = Bridge.parseJSON(leaderData)
                end
            elseif event == "pastRounds" then
                local roundsData = msgBlock:match('"data":(%[.-%])')
                if roundsData then
                    msg.data = Bridge.parsePastRoundsJSON(roundsData)
                end
            elseif event == "onlinePlayers" then
                local playersData = msgBlock:match('"data":(%[.-%])')
                if playersData then
                    msg.data = Bridge.parseOnlinePlayersJSON(playersData)
                end
            end

            table.insert(messages, msg)
        end
    end

    return messages
end

-- Handle a single message from JavaScript
function Bridge.handleMessage(msg)
    if not msg or not msg.event then return end

    local event = msg.event
    local data = msg.data or {}

    if event == "walletState" then
        Bridge.walletConnected = data.connected
        Bridge.walletAddress = data.address
        print("[Bridge] Wallet state updated: " .. tostring(data.connected))
    elseif event == "chatMessage" then
        table.insert(Bridge.chatMessages, {
            sender = data.sender,
            message = data.message,
            timestamp = data.timestamp or os.time()
        })
        while #Bridge.chatMessages > 50 do
            table.remove(Bridge.chatMessages, 1)
        end
    elseif event == "poolData" then
        Bridge.poolBalance = data.balance or 0
        Bridge.endTimestamp = data.endTimestamp or 0
    elseif event == "gameData" then
        Bridge.characterSeed = data.characterSeed
        Bridge.roundId = data.roundId
        Bridge.ticketId = data.ticketId
    elseif event == "playerStats" then
        Bridge.playerStats.gamesPlayed = data.gamesPlayed or 0
        Bridge.playerStats.bestTime = data.bestTime or 0
        Bridge.playerStats.totalSpent = data.totalSpent or 0
    elseif event == "leaderboard" then
        if type(data) == "table" then
            Bridge.leaderboard = data
        end
    elseif event == "pastRounds" then
        if type(data) == "table" then
            Bridge.pastRounds = data
        end
    elseif event == "onlinePlayers" then
        if type(data) == "table" then
            Bridge.onlinePlayers = data
        end
    elseif event == "startGame" then
        love.event.push("startgame")
    end
end

function Bridge.sendToJS(event, data)
    -- Lazy init check in case called before Bridge.init()
    if Bridge.isBrowser == nil then
        Bridge.isBrowser = love.system.getOS() == "Web" or (type(js) == "table" and js.global ~= nil)
    end

    if Bridge.isBrowser and type(js) == "table" and js.global and js.global.receiveFromLua then
        js.global.receiveFromLua(event, data)
    else
        -- Queue for non-browser testing
        table.insert(Bridge.outQueue, {event = event, data = data})
    end
end

function Bridge.requestWalletConnect()
    Bridge.sendToJS("requestWalletConnect", {})
end

function Bridge.requestEnterGame()
    Bridge.sendToJS("requestEnterGame", {})
end

function Bridge.submitScore(survivalTime)
    Bridge.sendToJS("submitScore", {
        survivalTime = survivalTime,
        roundId = Bridge.roundId,
        ticketId = Bridge.ticketId
    })
end

function Bridge.sendChatMessage(message)
    Bridge.sendToJS("sendChat", {
        message = message,
        sender = Bridge.walletAddress or "Anonymous"
    })
end

function Bridge.setGameState(newState)
    Bridge.gameState = newState
    Bridge.sendToJS("gameStateChanged", {state = newState})
end

function Bridge.triggerHaptic(intensity)
    -- Trigger haptic feedback via JavaScript
    -- intensity: "light", "medium", or "heavy"
    if Bridge.isBrowser then
        Bridge.sendToJS("haptic", {
            intensity = intensity or "light"
        })
    end
end

function Bridge.getTimeRemaining()
    if Bridge.endTimestamp == 0 then return 0 end
    local now = os.time() * 1000
    return math.max(0, Bridge.endTimestamp - now)
end

function Bridge.formatTimeRemaining()
    local ms = Bridge.getTimeRemaining()
    local seconds = math.floor(ms / 1000)
    local minutes = math.floor(seconds / 60)
    seconds = seconds % 60
    return string.format("%02d:%02d", minutes, seconds)
end

-- Round state: "active" | "grace" | "ended"
function Bridge.getRoundState()
    local remaining = Bridge.getTimeRemaining()
    if Bridge.endTimestamp == 0 then
        return "active"  -- No round configured, allow play
    elseif remaining <= 0 then
        return "ended"
    elseif remaining <= Bridge.GRACE_PERIOD then
        return "grace"
    else
        return "active"
    end
end

function Bridge.isEntryAllowed()
    return Bridge.getRoundState() == "active"
end

function Bridge.getGraceTimeRemaining()
    local remaining = Bridge.getTimeRemaining()
    if remaining <= 0 then return 0 end
    return math.max(0, remaining)
end

function Bridge.formatSUI(amount)
    -- Convert from MIST to SUI (9 decimals)
    local sui = amount / 1000000000
    return string.format("%.2f SUI", sui)
end

-- Simple JSON parser for leaderboard data
function Bridge.parseJSON(str)
    if not str or str == "" then return nil end

    -- Replace JSON array/object markers with Lua table syntax
    local result = {}

    -- Try to use love.data.decode if available (Love2D 11.0+)
    if love and love.data and love.data.decode then
        local success, decoded = pcall(function()
            return love.data.decode("string", "base64", str)
        end)
        -- This won't work for JSON, but let's try a simple approach
    end

    -- Simple pattern matching for our expected format:
    -- [{rank:1,address:"0x...",survivalTime:12000,score:1200}, ...]
    local entries = {}
    for entry in str:gmatch("%{([^}]+)%}") do
        local item = {}
        -- Extract rank
        local rank = entry:match('"rank":(%d+)')
        if rank then item.rank = tonumber(rank) end

        -- Extract address
        local address = entry:match('"address":"([^"]+)"')
        if address then item.address = address end

        -- Extract survivalTime
        local time = entry:match('"survivalTime":(%d+)')
        if time then item.survivalTime = tonumber(time) end

        -- Extract score
        local score = entry:match('"score":(%d+)')
        if score then item.score = tonumber(score) end

        if item.rank then
            table.insert(entries, item)
        end
    end

    return entries
end

-- Parse past rounds JSON data
function Bridge.parsePastRoundsJSON(str)
    if not str or str == "" then return {} end

    local rounds = {}

    -- Pattern to match each round: {roundId:X,endTime:Y,winners:[...]}
    for roundData in str:gmatch("%{([^}]*winners[^}]*%])%}") do
        local round = {}

        -- Extract roundId
        local roundId = roundData:match('"roundId":(%d+)')
        if roundId then round.roundId = tonumber(roundId) end

        -- Extract endTime
        local endTime = roundData:match('"endTime":(%d+)')
        if endTime then round.endTime = tonumber(endTime) end

        -- Extract winners array
        round.winners = {}
        local winnersStr = roundData:match('"winners":%[(.-)%]')
        if winnersStr then
            for winnerData in winnersStr:gmatch("%{([^}]+)%}") do
                local winner = {}
                local rank = winnerData:match('"rank":(%d+)')
                if rank then winner.rank = tonumber(rank) end

                local address = winnerData:match('"address":"([^"]+)"')
                if address then winner.address = address end

                local survivalTime = winnerData:match('"survivalTime":(%d+)')
                if survivalTime then winner.survivalTime = tonumber(survivalTime) end

                if winner.rank then
                    table.insert(round.winners, winner)
                end
            end
        end

        if round.roundId then
            table.insert(rounds, round)
        end
    end

    return rounds
end

-- Parse online players JSON data
function Bridge.parseOnlinePlayersJSON(str)
    if not str or str == "" then return {} end

    local players = {}

    -- Pattern to match each player: {id:"X",address:"Y",characterSeed:Z,x:A,y:B}
    for playerData in str:gmatch("%{([^}]+)%}") do
        local player = {}

        -- Extract id
        local id = playerData:match('"id":"([^"]+)"')
        if id then player.id = id end

        -- Extract address
        local address = playerData:match('"address":"([^"]+)"')
        if address then player.address = address end

        -- Extract characterSeed
        local seed = playerData:match('"characterSeed":(%d+)')
        if seed then player.characterSeed = tonumber(seed) end

        -- Extract x
        local x = playerData:match('"x":([%d%.]+)')
        if x then player.x = tonumber(x) end

        -- Extract y
        local y = playerData:match('"y":([%d%.]+)')
        if y then player.y = tonumber(y) end

        if player.id then
            table.insert(players, player)
        end
    end

    return players
end

-- Get formatted leaderboard for display
function Bridge.getFormattedLeaderboard()
    local formatted = {}
    for i, entry in ipairs(Bridge.leaderboard) do
        local shortAddr = entry.address
        if #shortAddr > 12 then
            shortAddr = string.sub(entry.address, 1, 6) .. ".." .. string.sub(entry.address, -4)
        end
        table.insert(formatted, {
            rank = entry.rank or i,
            name = shortAddr,
            time = math.floor((entry.survivalTime or 0) / 1000),
            score = entry.score or 0,
        })
    end
    return formatted
end

return Bridge
