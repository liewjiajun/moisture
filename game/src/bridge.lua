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

function Bridge.init()
    -- Detect browser environment (Love.js) - must be done after runtime init
    Bridge.isBrowser = love.system.getOS() == "Web"
    if not Bridge.isBrowser then
        -- Fallback check for js global
        Bridge.isBrowser = (type(js) == "table" and js.global ~= nil)
    end

    -- Set up global functions for JS to call
    if Bridge.isBrowser and js then
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
