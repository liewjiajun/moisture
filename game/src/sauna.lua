-- Sauna Lounge System
-- Social area where players hang out before games

local Character = require("src.character")
local Bridge = require("src.bridge")
local Sounds = require("src.sounds")

local Sauna = {}
Sauna.__index = Sauna

-- NPC configurations (other "players" in the sauna)
local NPC_NAMES = {
    "Aiko", "Yuki", "Sakura", "Hana", "Rei", "Miku", "Kaori", "Rin",
    "Sora", "Luna", "Mei", "Nana", "Yui", "Kira", "Ami", "Emi",
    "Tomo", "Momo", "Koko", "Nene", "Saki", "Maki", "Riku", "Haru",
}

-- Chat message pool (pre-written ambient chat)
local CHAT_MESSAGES = {
    -- Greetings
    "Hey everyone!",
    "Hi hi~",
    "Good luck today!",
    "Ready to play?",
    "Let's go!",
    -- Game talk
    "I almost beat my record!",
    "The witch is so hard...",
    "Love the new enemies!",
    "Those bullets are crazy",
    "Need more practice",
    "So close to winning!",
    "My reflexes are getting better",
    "The angel is brutal",
    "Fairies are so cute tho",
    "I keep dying to slimes lol",
    -- Reactions
    "Wow!",
    "Nice!",
    "Haha",
    "Same tbh",
    "True",
    "Fr fr",
    "Ikr",
    "Gl!",
    -- Questions
    "Anyone wanna team up?",
    "What's your best time?",
    "Any tips?",
    "Which upgrade is best?",
    -- Miscellaneous
    "This music is nice",
    "Love this game",
    "Steam feels good",
    "Cozy vibes",
    "Relaxing...",
    "Ready when you are",
    "*stretches*",
    "*sips tea*",
}

function Sauna.new(screenWidth, screenHeight)
    local self = setmetatable({}, Sauna)

    self.width = screenWidth
    self.height = screenHeight

    -- NPCs in the lounge
    self.npcs = {}
    self:generateNPCs()

    -- Steam particles
    self.steamParticles = {}

    -- Chat messages
    self.chatMessages = {}
    self.chatTimer = 0
    self.maxChatMessages = 6

    -- Background elements
    self.tiles = {}
    self:generateBackground()

    -- Ambient timers
    self.steamTimer = 0
    self.npcMoveTimer = 0

    -- UI state
    self.playButtonHover = false
    self.playButtonPulse = 0

    -- Leaderboard data (simulated)
    self.leaderboard = self:generateLeaderboard()

    -- Player movement state
    self.playerX = 90
    self.playerY = 140
    self.playerFacingLeft = false
    self.playerIsMoving = false
    self.PLAYER_SPEED = 40

    -- Door state
    self.doorX = 160
    self.doorY = 115
    self.doorWidth = 18
    self.doorHeight = 35
    self.nearDoor = false
    self.isPracticeMode = false

    -- Chat input state
    self.chatInput = ""
    self.chatInputActive = false

    return self
end

function Sauna:generateNPCs()
    -- Generate 5-8 NPCs
    local count = love.math.random(5, 8)
    local usedPositions = {}

    for i = 1, count do
        local seed = love.math.random(1, 999999999)
        local char = Character.new(seed)

        -- Find non-overlapping position (avoid door area on right)
        local x, y
        local attempts = 0
        repeat
            x = love.math.random(20, self.width - 40)  -- Leave space for door
            y = love.math.random(105, 180)  -- Walking area
            attempts = attempts + 1
        until not self:positionOverlaps(x, y, usedPositions) or attempts > 20

        table.insert(usedPositions, {x = x, y = y})

        table.insert(self.npcs, {
            character = char,
            name = NPC_NAMES[love.math.random(1, #NPC_NAMES)],
            x = x,
            y = y,
            targetX = x,
            targetY = y,
            facingLeft = love.math.random() > 0.5,
            isMoving = false,
            chatBubble = nil,
            chatTimer = 0,
            idleTimer = love.math.random() * 5,
            bobOffset = love.math.random() * math.pi * 2,
        })
    end
end

function Sauna:positionOverlaps(x, y, positions)
    for _, pos in ipairs(positions) do
        local dist = math.sqrt((x - pos.x)^2 + (y - pos.y)^2)
        if dist < 25 then
            return true
        end
    end
    return false
end

function Sauna:generateBackground()
    -- Generate wooden floor tile pattern
    local tileSize = 8
    for y = 0, self.height, tileSize do
        for x = 0, self.width, tileSize do
            local shade = 0.15 + love.math.random() * 0.05
            if (math.floor(x / tileSize) + math.floor(y / tileSize)) % 2 == 0 then
                shade = shade + 0.02
            end
            table.insert(self.tiles, {
                x = x,
                y = y,
                shade = shade,
                grain = love.math.random() * 0.02,
            })
        end
    end
end

function Sauna:generateLeaderboard()
    -- Generate fake leaderboard data
    local board = {}
    local fakeNames = {"ProDodger", "BulletMaster", "SurviveKing", "DodgeQueen", "SpeedRunner",
                       "NoHitPro", "GhostDancer", "NinjaMoves", "ReflexGod", "AceMover"}

    for i = 1, 10 do
        table.insert(board, {
            rank = i,
            name = fakeNames[i] or ("Player" .. i),
            time = math.floor(120 - (i - 1) * 8 + love.math.random(-3, 3)),
            score = math.floor((120 - (i - 1) * 8) * 100 + love.math.random(-200, 200)),
        })
    end

    return board
end

function Sauna:update(dt, touchControls)
    -- Update steam particles
    self.steamTimer = self.steamTimer + dt
    if self.steamTimer > 0.1 then
        self.steamTimer = 0
        self:spawnSteam()
    end

    -- Update steam particles
    for i = #self.steamParticles, 1, -1 do
        local p = self.steamParticles[i]
        p.y = p.y - p.speed * dt
        p.x = p.x + math.sin(p.wobble + p.y * 0.1) * 0.3
        p.life = p.life - dt
        p.alpha = p.life / p.maxLife * 0.3

        if p.life <= 0 then
            table.remove(self.steamParticles, i)
        end
    end

    -- Update player movement (if touchControls provided)
    if touchControls then
        local dx, dy = touchControls:getMovement()
        if dx ~= 0 or dy ~= 0 then
            self.playerX = self.playerX + dx * self.PLAYER_SPEED * dt
            self.playerY = self.playerY + dy * self.PLAYER_SPEED * dt
            self.playerIsMoving = true
            if dx ~= 0 then
                self.playerFacingLeft = dx < 0
            end
            -- Clamp to room bounds (walking area)
            self.playerX = math.max(15, math.min(self.width - 15, self.playerX))
            self.playerY = math.max(100, math.min(185, self.playerY))
        else
            self.playerIsMoving = false
        end
    end

    -- Check door proximity
    local doorCenterX = self.doorX + self.doorWidth / 2
    local doorCenterY = self.doorY + self.doorHeight / 2
    local dist = math.sqrt((self.playerX - doorCenterX)^2 + (self.playerY - doorCenterY)^2)
    self.nearDoor = dist < 30

    -- Update NPCs
    self.npcMoveTimer = self.npcMoveTimer + dt
    for _, npc in ipairs(self.npcs) do
        -- Idle timer for movement
        npc.idleTimer = npc.idleTimer - dt
        if npc.idleTimer <= 0 then
            npc.idleTimer = 3 + love.math.random() * 5
            -- Decide to move or chat
            if love.math.random() < 0.4 then
                -- Move to new position (avoid door area)
                npc.targetX = love.math.random(20, self.width - 40)
                npc.targetY = love.math.random(105, 180)
            elseif love.math.random() < 0.3 and not npc.chatBubble then
                -- Say something
                npc.chatBubble = CHAT_MESSAGES[love.math.random(1, #CHAT_MESSAGES)]
                npc.chatTimer = 3 + love.math.random() * 2
                -- Add to chat log
                self:addChatMessage(npc.name, npc.chatBubble)
            end
        end

        -- Move towards target
        local dx = npc.targetX - npc.x
        local dy = npc.targetY - npc.y
        local dist = math.sqrt(dx * dx + dy * dy)

        if dist > 2 then
            npc.isMoving = true
            local speed = 20
            npc.x = npc.x + (dx / dist) * speed * dt
            npc.y = npc.y + (dy / dist) * speed * dt
            npc.facingLeft = dx < 0
        else
            npc.isMoving = false
        end

        -- Update character animation
        npc.character:update(dt, npc.isMoving)

        -- Update chat bubble
        if npc.chatBubble then
            npc.chatTimer = npc.chatTimer - dt
            if npc.chatTimer <= 0 then
                npc.chatBubble = nil
            end
        end
    end

    -- Auto-generate chat messages occasionally
    self.chatTimer = self.chatTimer + dt
    if self.chatTimer > 8 + love.math.random() * 4 then
        self.chatTimer = 0
        -- Random NPC says something
        local randomNpc = self.npcs[love.math.random(1, #self.npcs)]
        if not randomNpc.chatBubble then
            randomNpc.chatBubble = CHAT_MESSAGES[love.math.random(1, #CHAT_MESSAGES)]
            randomNpc.chatTimer = 3 + love.math.random() * 2
            self:addChatMessage(randomNpc.name, randomNpc.chatBubble)
        end
    end

    -- Play button pulse
    self.playButtonPulse = self.playButtonPulse + dt * 3
end

function Sauna:spawnSteam()
    -- Spawn steam from bottom
    for i = 1, 2 do
        table.insert(self.steamParticles, {
            x = love.math.random(0, self.width),
            y = self.height + love.math.random(0, 10),
            speed = 15 + love.math.random() * 10,
            life = 4 + love.math.random() * 2,
            maxLife = 4 + love.math.random() * 2,
            alpha = 0.3,
            size = 3 + love.math.random() * 3,
            wobble = love.math.random() * math.pi * 2,
        })
    end
end

function Sauna:addChatMessage(name, message, playSound)
    table.insert(self.chatMessages, 1, {
        name = name,
        message = message,
        time = 0,
    })

    -- Play chat notification sound (optional, skip for NPC ambient chat)
    if playSound then
        Sounds.playVaried("chat", 0.2, 0.3)
    end

    -- Keep only recent messages
    while #self.chatMessages > self.maxChatMessages do
        table.remove(self.chatMessages)
    end
end

-- Draw just the background (for menu screen)
function Sauna:drawBackground(gameTime)
    local w, h = self.width, self.height

    -- Background - wooden sauna floor
    for _, tile in ipairs(self.tiles) do
        local shade = tile.shade + math.sin(tile.x * 0.1 + tile.y * 0.1) * tile.grain
        love.graphics.setColor(shade + 0.05, shade, shade - 0.02, 1)
        love.graphics.rectangle("fill", tile.x, tile.y, 8, 8)
    end

    -- Warm gradient overlay
    for y = 0, h, 4 do
        local alpha = 0.05 + (y / h) * 0.08
        love.graphics.setColor(0.3, 0.15, 0.1, alpha)
        love.graphics.rectangle("fill", 0, y, w, 4)
    end

    -- Steam particles
    for _, p in ipairs(self.steamParticles) do
        love.graphics.setColor(0.9, 0.9, 0.95, p.alpha * 0.5)
        love.graphics.circle("fill", p.x, p.y, p.size)
    end

    -- Draw NPCs (without player)
    for _, npc in ipairs(self.npcs) do
        -- Draw shadow
        love.graphics.setColor(0, 0, 0, 0.2)
        love.graphics.ellipse("fill", npc.x, npc.y + 8, 5, 2)

        -- Draw character
        love.graphics.setColor(1, 1, 1, 0.7)
        npc.character:draw(math.floor(npc.x), math.floor(npc.y), 1, npc.facingLeft)
    end
end

function Sauna:draw(playerCharacter, gameTime, fonts, isGuest)
    local w, h = self.width, self.height

    -- Background - wooden sauna floor
    for _, tile in ipairs(self.tiles) do
        local shade = tile.shade + math.sin(tile.x * 0.1 + tile.y * 0.1) * tile.grain
        love.graphics.setColor(shade + 0.05, shade, shade - 0.02, 1)
        love.graphics.rectangle("fill", tile.x, tile.y, 8, 8)
    end

    -- Warm gradient overlay
    for y = 0, h, 4 do
        local alpha = 0.05 + (y / h) * 0.08
        love.graphics.setColor(0.3, 0.15, 0.1, alpha)
        love.graphics.rectangle("fill", 0, y, w, 4)
    end

    -- Steam particles (behind characters)
    for _, p in ipairs(self.steamParticles) do
        love.graphics.setColor(0.9, 0.9, 0.95, p.alpha * 0.5)
        love.graphics.circle("fill", p.x, p.y, p.size)
    end

    -- Draw NPCs and online players (sorted by Y position)
    local drawOrder = {}

    -- Add NPCs to draw order
    for _, npc in ipairs(self.npcs) do
        table.insert(drawOrder, {type = "npc", data = npc, y = npc.y})
    end

    -- Add online players to draw order
    for _, onlinePlayer in ipairs(Bridge.onlinePlayers) do
        -- Create a character for online player if needed
        if not onlinePlayer.character then
            onlinePlayer.character = Character.new(onlinePlayer.characterSeed or 12345)
        end
        -- Update character position and animation
        onlinePlayer.character:update(love.timer.getDelta(), false)

        table.insert(drawOrder, {
            type = "online",
            data = onlinePlayer,
            y = onlinePlayer.y or 160
        })
    end

    -- Add player to draw order (at actual position)
    if playerCharacter then
        table.insert(drawOrder, {type = "player", data = playerCharacter, y = self.playerY})
    end

    table.sort(drawOrder, function(a, b) return a.y < b.y end)

    for _, obj in ipairs(drawOrder) do
        if obj.type == "npc" then
            local npc = obj.data
            -- Draw shadow
            love.graphics.setColor(0, 0, 0, 0.2)
            love.graphics.ellipse("fill", npc.x, npc.y + 8, 5, 2)

            -- Draw character
            love.graphics.setColor(1, 1, 1, 1)
            npc.character:draw(math.floor(npc.x), math.floor(npc.y), 1, npc.facingLeft)

            -- Draw chat bubble
            if npc.chatBubble then
                self:drawChatBubble(npc.x, npc.y - 20, npc.chatBubble, fonts)
            end

            -- Draw name (gray for NPCs)
            love.graphics.setColor(0.7, 0.7, 0.7, 0.8)
            love.graphics.setFont(fonts.small)
            love.graphics.printf(npc.name, npc.x - 20, npc.y + 10, 40, "center")
        elseif obj.type == "online" then
            local onlinePlayer = obj.data
            local px = onlinePlayer.x or 90
            local py = onlinePlayer.y or 160

            -- Draw shadow
            love.graphics.setColor(0, 0, 0, 0.25)
            love.graphics.ellipse("fill", px, py + 8, 6, 2)

            -- Draw character with slight glow for online players
            love.graphics.setColor(0.4, 0.9, 1, 0.15)
            love.graphics.circle("fill", px, py, 10)

            love.graphics.setColor(1, 1, 1, 1)
            if onlinePlayer.character then
                onlinePlayer.character:draw(math.floor(px), math.floor(py), 1, false)
            end

            -- Draw shortened address (cyan for real players)
            local shortAddr = onlinePlayer.address or "0x????"
            if #shortAddr > 8 then
                shortAddr = string.sub(shortAddr, 1, 4) .. ".." .. string.sub(shortAddr, -2)
            end
            love.graphics.setColor(0.3, 0.9, 1, 0.9)
            love.graphics.setFont(fonts.small)
            love.graphics.printf(shortAddr, px - 20, py + 10, 40, "center")
        elseif obj.type == "player" then
            -- Player character at actual position
            local px = self.playerX
            local py = self.playerY

            -- Draw shadow
            love.graphics.setColor(0, 0, 0, 0.3)
            love.graphics.ellipse("fill", px, py + 8, 6, 2)

            -- Draw player
            love.graphics.setColor(1, 1, 1, 1)
            obj.data:draw(math.floor(px), math.floor(py), 1, self.playerFacingLeft)

            -- "YOU" indicator (cyan, above head)
            love.graphics.setColor(0, 1, 1, 0.9)
            love.graphics.setFont(fonts.small)
            love.graphics.printf("YOU", px - 15, py + 10, 30, "center")
        end
    end

    -- Steam particles (in front)
    for _, p in ipairs(self.steamParticles) do
        if p.y < h * 0.5 then
            love.graphics.setColor(0.95, 0.95, 1, p.alpha * 0.3)
            love.graphics.circle("fill", p.x, p.y, p.size * 0.7)
        end
    end

    -- Draw door (in world)
    self:drawDoor(fonts, gameTime)

    -- UI Elements

    -- Title
    love.graphics.setFont(fonts.large)
    love.graphics.setColor(1, 0.9, 0.8, 1)
    local title = "THE SAUNA"
    local tw = fonts.large:getWidth(title)
    love.graphics.print(title, math.floor((w - tw) / 2), 8)

    -- Wallet info (top left)
    self:drawWalletInfo(4, 8, fonts)

    -- Info bar (above chat area)
    self:drawInfoBar(w / 2, 195, fonts, gameTime)

    -- Leaderboard sign (in-world, top left)
    self:drawLeaderboardSign(5, 75, 50, 70, fonts)

    -- Stats panel (in-world, top right area)
    if Bridge.walletConnected then
        self:drawStatsPanel(w - 55, 75, 50, 43, fonts)
    end

    -- Past round winners (below stats panel)
    self:drawPastWinners(w - 55, 122, 50, 35, fonts)

    -- Chat box (bottom)
    self:drawChatBox(4, 210, w - 8, 55, fonts)

    -- Chat input (always visible)
    self:drawChatInput(4, 268, w - 8, fonts)

    -- Door prompt (when near door)
    if self.nearDoor then
        self:drawDoorPrompt(fonts, gameTime)
    end

    -- Menu button (top-left corner)
    love.graphics.setColor(0, 0, 0, 0.5)
    love.graphics.rectangle("fill", 4, 4, 28, 14, 3)
    love.graphics.setColor(0.7, 0.7, 0.7, 0.8)
    love.graphics.rectangle("line", 4, 4, 28, 14, 3)
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(0.9, 0.9, 0.9, 0.9)
    love.graphics.printf("MENU", 4, 6, 28, "center")

    -- Guest indicator
    if isGuest and not Bridge.walletConnected then
        love.graphics.setFont(fonts.small)
        love.graphics.setColor(0.6, 0.6, 0.6, 0.7)
        love.graphics.printf("Guest Mode", 0, 25, w, "center")
    end

    -- Player count (NPCs + online players + you)
    local totalCount = #self.npcs + #Bridge.onlinePlayers + 1
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(0.6, 0.8, 0.6, 0.8)
    love.graphics.printf(totalCount .. " online", 0, 35, w, "center")
end

function Sauna:drawChatBubble(x, y, message, fonts)
    love.graphics.setFont(fonts.small)
    local textWidth = math.min(fonts.small:getWidth(message), 50)
    local bubbleWidth = textWidth + 6
    local bubbleHeight = 10

    -- Bubble background
    love.graphics.setColor(1, 1, 1, 0.9)
    love.graphics.rectangle("fill", x - bubbleWidth / 2, y - bubbleHeight, bubbleWidth, bubbleHeight, 2)

    -- Bubble tail
    love.graphics.polygon("fill",
        x - 2, y - 1,
        x + 2, y - 1,
        x, y + 2
    )

    -- Text
    love.graphics.setColor(0.1, 0.1, 0.1, 1)
    love.graphics.printf(message, x - bubbleWidth / 2 + 3, y - bubbleHeight + 2, bubbleWidth - 6, "left")
end

function Sauna:drawChatBox(x, y, w, h, fonts)
    -- Background
    love.graphics.setColor(0, 0, 0, 0.6)
    love.graphics.rectangle("fill", x, y, w, h, 2)

    -- Border
    love.graphics.setColor(0.4, 0.3, 0.2, 0.8)
    love.graphics.rectangle("line", x, y, w, h, 2)

    -- Title
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(0.9, 0.8, 0.7, 1)
    love.graphics.print("CHAT", x + 2, y + 1)

    -- Messages (single line format for wider box)
    local messageY = y + 11
    local maxMsgWidth = w - 6
    for i, msg in ipairs(self.chatMessages) do
        if messageY < y + h - 2 then
            -- Name in cyan
            love.graphics.setColor(0.6, 0.8, 1, 0.9)
            local nameStr = string.sub(msg.name, 1, 6) .. ": "
            love.graphics.print(nameStr, x + 2, messageY)

            -- Message
            love.graphics.setColor(0.9, 0.9, 0.9, 0.9)
            local nameWidth = fonts.small:getWidth(nameStr)
            local maxChars = math.floor((maxMsgWidth - nameWidth) / 5)  -- Approx char width
            local truncated = string.sub(msg.message, 1, math.max(15, maxChars))
            love.graphics.print(truncated, x + 2 + nameWidth, messageY)

            messageY = messageY + 9
        end
    end
end

function Sauna:drawStatsPanel(x, y, w, h, fonts)
    -- Background
    love.graphics.setColor(0, 0, 0, 0.6)
    love.graphics.rectangle("fill", x, y, w, h, 2)

    -- Border
    love.graphics.setColor(0.3, 0.7, 1, 0.6)
    love.graphics.rectangle("line", x, y, w, h, 2)

    -- Title
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(0.5, 0.8, 1, 1)
    love.graphics.print("YOUR STATS", x + 2, y + 1)

    local stats = Bridge.playerStats
    local entryY = y + 11

    -- Games played
    love.graphics.setColor(0.7, 0.7, 0.7, 0.9)
    love.graphics.print("Games:", x + 2, entryY)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf(tostring(stats.gamesPlayed), x, entryY, w - 2, "right")
    entryY = entryY + 9

    -- Best time
    love.graphics.setColor(0.7, 0.7, 0.7, 0.9)
    love.graphics.print("Best:", x + 2, entryY)
    love.graphics.setColor(0.5, 1, 0.5, 1)
    local bestTimeStr = string.format("%.1fs", stats.bestTime / 1000)
    love.graphics.printf(bestTimeStr, x, entryY, w - 2, "right")
    entryY = entryY + 9

    -- Total spent
    love.graphics.setColor(0.7, 0.7, 0.7, 0.9)
    love.graphics.print("Spent:", x + 2, entryY)
    love.graphics.setColor(1, 0.9, 0.5, 1)
    local spentStr = string.format("%.1f SUI", stats.totalSpent)
    love.graphics.printf(spentStr, x, entryY, w - 2, "right")
end

function Sauna:drawPastWinners(x, y, w, h, fonts)
    local rounds = Bridge.pastRounds
    if #rounds == 0 then return end

    -- Background
    love.graphics.setColor(0, 0, 0, 0.5)
    love.graphics.rectangle("fill", x, y, w, h, 2)

    -- Border
    love.graphics.setColor(1, 0.7, 0.3, 0.5)
    love.graphics.rectangle("line", x, y, w, h, 2)

    -- Title
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(1, 0.8, 0.5, 1)
    love.graphics.print("PAST WINNERS", x + 2, y + 1)

    local entryY = y + 10
    for i, round in ipairs(rounds) do
        if i > 3 then break end  -- Show max 3 rounds
        if entryY + 15 > y + h then break end

        -- Round header
        love.graphics.setColor(0.6, 0.6, 0.6, 0.7)
        love.graphics.print("R" .. round.roundId, x + 2, entryY)

        -- Top winner
        if round.winners and round.winners[1] then
            local winner = round.winners[1]
            local shortAddr = winner.address
            if #shortAddr > 8 then
                shortAddr = string.sub(winner.address, 1, 4) .. ".." .. string.sub(winner.address, -2)
            end

            love.graphics.setColor(1, 0.85, 0.2, 1)
            love.graphics.print(shortAddr, x + 15, entryY)

            local timeStr = string.format("%.1fs", winner.survivalTime / 1000)
            love.graphics.setColor(0.5, 0.8, 0.5, 0.8)
            love.graphics.printf(timeStr, x, entryY, w - 2, "right")
        end

        entryY = entryY + 10
    end
end

function Sauna:drawLeaderboard(x, y, w, h, fonts)
    -- Background
    love.graphics.setColor(0, 0, 0, 0.6)
    love.graphics.rectangle("fill", x, y, w, h, 2)

    -- Border
    love.graphics.setColor(1, 0.85, 0.2, 0.6)
    love.graphics.rectangle("line", x, y, w, h, 2)

    -- Title
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(1, 0.9, 0.5, 1)
    love.graphics.print("TOP", x + 2, y + 1)

    -- Use Firebase leaderboard if available, otherwise use local
    local leaderboard = self.leaderboard
    local bridgeLeaderboard = Bridge.getFormattedLeaderboard()
    if #bridgeLeaderboard > 0 then
        leaderboard = bridgeLeaderboard
    end

    -- Entries
    local entryY = y + 10
    for i = 1, math.min(5, #leaderboard) do
        local entry = leaderboard[i]
        if entryY < y + h - 6 then
            -- Rank color
            if i == 1 then
                love.graphics.setColor(1, 0.85, 0.2, 1)
            elseif i == 2 then
                love.graphics.setColor(0.8, 0.8, 0.85, 1)
            elseif i == 3 then
                love.graphics.setColor(0.8, 0.5, 0.3, 1)
            else
                love.graphics.setColor(0.7, 0.7, 0.7, 0.8)
            end

            -- Rank and abbreviated name
            local displayName = string.sub(entry.name, 1, 6)
            love.graphics.print(i .. "." .. displayName, x + 2, entryY)

            -- Time
            love.graphics.setColor(0.5, 0.8, 0.5, 0.8)
            love.graphics.print(entry.time .. "s", x + 2, entryY + 7)

            entryY = entryY + 15
        end
    end
end

function Sauna:drawWalletInfo(x, y, fonts)
    love.graphics.setFont(fonts.small)

    if Bridge.walletConnected and Bridge.walletAddress then
        -- Connected indicator
        love.graphics.setColor(0.3, 0.8, 0.3, 1)
        love.graphics.circle("fill", x + 3, y + 3, 2)

        -- Truncated address
        local addr = Bridge.walletAddress
        local shortAddr = string.sub(addr, 1, 6) .. ".." .. string.sub(addr, -4)
        love.graphics.setColor(0.7, 0.8, 0.9, 0.9)
        love.graphics.print(shortAddr, x + 8, y)
    else
        -- Not connected
        love.graphics.setColor(0.8, 0.4, 0.4, 1)
        love.graphics.circle("fill", x + 3, y + 3, 2)
        love.graphics.setColor(0.7, 0.6, 0.6, 0.9)
        love.graphics.print("Not Connected", x + 8, y)
    end
end

function Sauna:drawPoolInfo(x, y, fonts, gameTime)
    love.graphics.setFont(fonts.small)

    -- Pool balance display
    local poolText = "Pool: " .. Bridge.formatSUI(Bridge.poolBalance)
    love.graphics.setColor(1, 0.9, 0.5, 0.9)
    love.graphics.printf(poolText, x - 40, y, 80, "center")

    -- Round state display with colors
    local roundState = Bridge.getRoundState()

    if roundState == "active" then
        -- Active: cyan color, show time remaining
        love.graphics.setColor(0.4, 0.9, 1, 0.9)
        local timeText = "Round ends: " .. Bridge.formatTimeRemaining()
        love.graphics.printf(timeText, x - 50, y + 8, 100, "center")
    elseif roundState == "grace" then
        -- Grace period: red flashing, entry closed
        local flash = 0.7 + math.sin((gameTime or 0) * 6) * 0.3
        love.graphics.setColor(1, 0.3, 0.3, flash)
        love.graphics.printf("ENTRY CLOSED", x - 50, y + 8, 100, "center")
        love.graphics.setColor(1, 0.5, 0.5, 0.7)
        local graceText = Bridge.formatTimeRemaining() .. " left"
        love.graphics.printf(graceText, x - 40, y + 17, 80, "center")
    elseif roundState == "ended" then
        -- Round ended: gray
        love.graphics.setColor(0.6, 0.6, 0.6, 0.8)
        love.graphics.printf("Round ended", x - 50, y + 8, 100, "center")
        love.graphics.setColor(0.5, 0.5, 0.5, 0.6)
        love.graphics.printf("Starting soon...", x - 50, y + 17, 100, "center")
    elseif Bridge.endTimestamp > 0 then
        -- Fallback: show time remaining
        local timeText = "Round ends: " .. Bridge.formatTimeRemaining()
        love.graphics.setColor(0.7, 0.8, 0.9, 0.8)
        love.graphics.printf(timeText, x - 50, y + 8, 100, "center")
    end
end

function Sauna:reset()
    -- Reset NPCs and chat for a fresh lounge experience
    self.npcs = {}
    self:generateNPCs()
    self.chatMessages = {}
    self.steamParticles = {}
    self.leaderboard = self:generateLeaderboard()
    -- Reset player position
    self.playerX = 90
    self.playerY = 140
end

-- Draw the door in the world
function Sauna:drawDoor(fonts, gameTime)
    local x, y = self.doorX, self.doorY
    local w, h = self.doorWidth, self.doorHeight

    -- Outer glow when near (pulsing)
    if self.nearDoor then
        local pulse = 0.3 + math.sin(gameTime * 3) * 0.15
        love.graphics.setColor(0, 1, 1, pulse * 0.4)
        love.graphics.rectangle("fill", x - 6, y - 6, w + 12, h + 12, 4)
        love.graphics.setColor(0, 1, 1, pulse * 0.6)
        love.graphics.rectangle("fill", x - 4, y - 4, w + 8, h + 8, 3)
    end

    -- Door shadow (depth effect)
    love.graphics.setColor(0, 0, 0, 0.4)
    love.graphics.rectangle("fill", x + 2, y + 2, w, h)

    -- Door frame (dark wood with border)
    love.graphics.setColor(0.2, 0.12, 0.08, 1)
    love.graphics.rectangle("fill", x - 3, y - 3, w + 6, h + 6)
    love.graphics.setColor(0.3, 0.18, 0.12, 1)
    love.graphics.rectangle("fill", x - 2, y - 2, w + 4, h + 4)

    -- Door body with wood grain
    local doorColor = self.nearDoor and {0.45, 0.28, 0.18} or {0.38, 0.22, 0.14}
    love.graphics.setColor(doorColor[1], doorColor[2], doorColor[3], 1)
    love.graphics.rectangle("fill", x, y, w, h)

    -- Wood grain lines
    love.graphics.setColor(doorColor[1] * 0.85, doorColor[2] * 0.85, doorColor[3] * 0.85, 0.6)
    for i = 0, 3 do
        love.graphics.line(x + 2, y + 8 + i * 8, x + w - 2, y + 8 + i * 8)
    end

    -- Door handle with shine
    love.graphics.setColor(0.6, 0.5, 0.25, 1)
    love.graphics.circle("fill", x + w - 5, y + h / 2, 2.5)
    love.graphics.setColor(0.85, 0.75, 0.4, 1)
    love.graphics.circle("fill", x + w - 5.5, y + h / 2 - 0.5, 1)

    -- Door label with background
    love.graphics.setFont(fonts.small)
    local labelY = y - 14

    -- Label background
    love.graphics.setColor(0.1, 0.08, 0.06, 0.9)
    love.graphics.rectangle("fill", x - 3, labelY - 1, w + 6, 10, 2)

    if self.nearDoor then
        -- Glowing label when near
        local pulse = 0.7 + math.sin(gameTime * 4) * 0.3
        love.graphics.setColor(0, 1, 1, pulse)
    else
        love.graphics.setColor(1, 0.9, 0.7, 0.9)
    end
    love.graphics.printf("GAME", x - 3, labelY, w + 6, "center")

    -- Border highlight when near
    if self.nearDoor then
        love.graphics.setColor(0, 1, 1, 0.5 + math.sin(gameTime * 4) * 0.2)
        love.graphics.setLineWidth(1.5)
        love.graphics.rectangle("line", x - 3, y - 3, w + 6, h + 6, 2)
        love.graphics.setLineWidth(1)
    end
end

-- Draw door prompt when player is near
function Sauna:drawDoorPrompt(fonts, gameTime)
    local w, h = self.width, self.height
    local promptY = 55

    -- Background panel
    love.graphics.setColor(0, 0, 0, 0.85)
    love.graphics.rectangle("fill", w/2 - 55, promptY, 110, 45, 4)
    love.graphics.setColor(0, 1, 1, 0.6)
    love.graphics.rectangle("line", w/2 - 55, promptY, 110, 45, 4)

    love.graphics.setFont(fonts.small)

    -- Toggle buttons
    local toggleY = promptY + 5
    local playBtnW, practiceBtnW = 50, 50
    local playX = w/2 - 52
    local practiceX = w/2 + 2

    -- Play button
    if not self.isPracticeMode then
        love.graphics.setColor(0, 0.4, 0.4, 1)
        love.graphics.rectangle("fill", playX, toggleY, playBtnW, 16, 2)
        love.graphics.setColor(0, 1, 1, 1)
    else
        love.graphics.setColor(0.2, 0.2, 0.2, 0.8)
        love.graphics.rectangle("fill", playX, toggleY, playBtnW, 16, 2)
        love.graphics.setColor(0.5, 0.5, 0.5, 0.8)
    end
    love.graphics.rectangle("line", playX, toggleY, playBtnW, 16, 2)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf("PLAY", playX, toggleY + 4, playBtnW, "center")

    -- Practice button
    if self.isPracticeMode then
        love.graphics.setColor(0.1, 0.3, 0.2, 1)
        love.graphics.rectangle("fill", practiceX, toggleY, practiceBtnW, 16, 2)
        love.graphics.setColor(0.3, 0.9, 0.6, 1)
    else
        love.graphics.setColor(0.2, 0.2, 0.2, 0.8)
        love.graphics.rectangle("fill", practiceX, toggleY, practiceBtnW, 16, 2)
        love.graphics.setColor(0.5, 0.5, 0.5, 0.8)
    end
    love.graphics.rectangle("line", practiceX, toggleY, practiceBtnW, 16, 2)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf("PRACTICE", practiceX, toggleY + 4, practiceBtnW, "center")

    -- Cost indicator
    local costY = toggleY + 18
    if not self.isPracticeMode then
        love.graphics.setColor(1, 0.9, 0.5, 0.9)
        love.graphics.printf("0.1 SUI", w/2 - 50, costY, 100, "center")
    else
        love.graphics.setColor(0.5, 0.8, 0.6, 0.9)
        love.graphics.printf("FREE", w/2 - 50, costY, 100, "center")
    end

    -- Enter button
    local enterY = costY + 10
    local pulse = 0.8 + math.sin(gameTime * 4) * 0.2
    love.graphics.setColor(0, pulse * 0.6, pulse * 0.6, 0.9)
    love.graphics.rectangle("fill", w/2 - 30, enterY, 60, 14, 2)
    love.graphics.setColor(0, 1, 1, pulse)
    love.graphics.rectangle("line", w/2 - 30, enterY, 60, 14, 2)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf("ENTER", w/2 - 30, enterY + 3, 60, "center")
end

-- Draw info bar (pool balance, round timer)
function Sauna:drawInfoBar(x, y, fonts, gameTime)
    love.graphics.setFont(fonts.small)

    -- Pool balance (left)
    local poolText = Bridge.formatSUI(Bridge.poolBalance)
    love.graphics.setColor(1, 0.9, 0.5, 0.9)
    love.graphics.printf("Pool: " .. poolText, x - 80, y, 60, "left")

    -- Round state (center)
    local roundState = Bridge.getRoundState()
    if roundState == "active" then
        love.graphics.setColor(0.4, 0.9, 1, 0.9)
        love.graphics.printf(Bridge.formatTimeRemaining(), x - 20, y, 40, "center")
    elseif roundState == "grace" then
        local flash = 0.7 + math.sin(gameTime * 6) * 0.3
        love.graphics.setColor(1, 0.3, 0.3, flash)
        love.graphics.printf("CLOSED", x - 25, y, 50, "center")
    else
        love.graphics.setColor(0.5, 0.5, 0.5, 0.7)
        love.graphics.printf("ENDED", x - 20, y, 40, "center")
    end

    -- Online count (right)
    local onlineCount = #self.npcs + #Bridge.onlinePlayers + 1
    love.graphics.setColor(0.6, 0.8, 0.6, 0.8)
    love.graphics.printf(onlineCount .. " here", x + 20, y, 60, "right")
end

-- Draw leaderboard as in-world sign
function Sauna:drawLeaderboardSign(x, y, w, h, fonts)
    -- Shadow for depth
    love.graphics.setColor(0, 0, 0, 0.3)
    love.graphics.rectangle("fill", x + 2, y + 2, w, h, 3)

    -- Wooden sign background with gradient
    love.graphics.setColor(0.35, 0.23, 0.14, 1)
    love.graphics.rectangle("fill", x, y, w, h, 3)
    love.graphics.setColor(0.28, 0.18, 0.1, 0.5)
    love.graphics.rectangle("fill", x, y + h/2, w, h/2, 3)

    -- Wood grain texture
    love.graphics.setColor(0.25, 0.16, 0.1, 0.4)
    for i = 0, 4 do
        love.graphics.line(x + 3, y + 8 + i * 14, x + w - 3, y + 8 + i * 14)
    end

    -- Sign border (thick wood frame)
    love.graphics.setColor(0.5, 0.35, 0.2, 1)
    love.graphics.setLineWidth(2)
    love.graphics.rectangle("line", x, y, w, h, 3)
    love.graphics.setLineWidth(1)
    love.graphics.setColor(0.4, 0.28, 0.16, 1)
    love.graphics.rectangle("line", x + 2, y + 2, w - 4, h - 4, 2)

    -- Title with underline
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(1, 0.95, 0.7, 1)
    love.graphics.print("TOP 5", x + 12, y + 2)
    love.graphics.setColor(1, 0.9, 0.5, 0.6)
    love.graphics.line(x + 4, y + 10, x + w - 4, y + 10)

    -- Use Firebase leaderboard if available
    local leaderboard = self.leaderboard
    local bridgeLeaderboard = Bridge.getFormattedLeaderboard()
    if #bridgeLeaderboard > 0 then
        leaderboard = bridgeLeaderboard
    end

    -- Entries with medal icons
    local entryY = y + 13
    for i = 1, math.min(5, #leaderboard) do
        local entry = leaderboard[i]
        if entryY < y + h - 6 then
            -- Medal circles for top 3
            if i <= 3 then
                local medalColors = {
                    {1, 0.85, 0.2},      -- Gold
                    {0.75, 0.75, 0.8},   -- Silver
                    {0.8, 0.5, 0.25}     -- Bronze
                }
                local mc = medalColors[i]
                love.graphics.setColor(mc[1] * 0.6, mc[2] * 0.6, mc[3] * 0.6, 1)
                love.graphics.circle("fill", x + 6, entryY + 5, 4)
                love.graphics.setColor(mc[1], mc[2], mc[3], 1)
                love.graphics.circle("fill", x + 6, entryY + 4.5, 3.5)
                love.graphics.setColor(0, 0, 0, 0.8)
                love.graphics.print(i, x + 4, entryY + 1)
            else
                love.graphics.setColor(0.6, 0.6, 0.6, 0.8)
                love.graphics.print(i .. ".", x + 3, entryY + 1)
            end

            -- Name
            local displayName = string.sub(entry.name, 1, 4)
            if i == 1 then
                love.graphics.setColor(1, 0.9, 0.4, 1)
            elseif i == 2 then
                love.graphics.setColor(0.85, 0.85, 0.9, 1)
            elseif i == 3 then
                love.graphics.setColor(0.9, 0.6, 0.35, 1)
            else
                love.graphics.setColor(0.75, 0.75, 0.75, 0.9)
            end
            love.graphics.print(displayName, x + 13, entryY + 1)

            -- Time (smaller, right-aligned)
            love.graphics.setColor(0.5, 0.85, 0.5, 0.9)
            love.graphics.printf(entry.time .. "s", x, entryY + 1, w - 3, "right")

            entryY = entryY + 11
        end
    end

    -- Empty state
    if #leaderboard == 0 then
        love.graphics.setColor(0.6, 0.6, 0.6, 0.7)
        love.graphics.printf("No scores", x, y + h/2 - 4, w, "center")
    end
end

-- Draw chat input field
function Sauna:drawChatInput(x, y, w, fonts)
    local inputH = 14
    local sendBtnW = 25

    -- Input background
    if self.chatInputActive then
        love.graphics.setColor(0.15, 0.15, 0.2, 0.95)
    else
        love.graphics.setColor(0.1, 0.1, 0.15, 0.8)
    end
    love.graphics.rectangle("fill", x, y, w - sendBtnW - 2, inputH, 2)

    -- Input border
    if self.chatInputActive then
        love.graphics.setColor(0, 1, 1, 0.8)
    else
        love.graphics.setColor(0.4, 0.4, 0.5, 0.6)
    end
    love.graphics.rectangle("line", x, y, w - sendBtnW - 2, inputH, 2)

    -- Input text or placeholder
    love.graphics.setFont(fonts.small)
    if #self.chatInput > 0 then
        love.graphics.setColor(1, 1, 1, 1)
        local displayText = string.sub(self.chatInput, -20)  -- Show last 20 chars
        love.graphics.print(displayText, x + 3, y + 3)
    else
        love.graphics.setColor(0.5, 0.5, 0.5, 0.6)
        love.graphics.print("Type message...", x + 3, y + 3)
    end

    -- Cursor blink
    if self.chatInputActive then
        local blink = math.sin(love.timer.getTime() * 4) > 0
        if blink then
            local cursorX = x + 3 + fonts.small:getWidth(string.sub(self.chatInput, -20))
            love.graphics.setColor(1, 1, 1, 0.8)
            love.graphics.line(cursorX, y + 2, cursorX, y + inputH - 2)
        end
    end

    -- Send button
    local sendX = x + w - sendBtnW
    love.graphics.setColor(0.1, 0.3, 0.25, 0.9)
    love.graphics.rectangle("fill", sendX, y, sendBtnW, inputH, 2)
    love.graphics.setColor(0.3, 0.8, 0.6, 0.9)
    love.graphics.rectangle("line", sendX, y, sendBtnW, inputH, 2)
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf("SEND", sendX, y + 3, sendBtnW, "center")
end

-- Check if door enter button is clicked
function Sauna:isDoorEnterClicked(gx, gy)
    if not self.nearDoor then return false end

    local w = self.width
    local enterY = 55 + 5 + 18 + 10  -- promptY + toggleY offset + costY offset + enterY offset
    return gx >= w/2 - 30 and gx <= w/2 + 30 and
           gy >= enterY and gy <= enterY + 14
end

-- Check if door toggle (play/practice) is clicked
function Sauna:isDoorToggleClicked(gx, gy)
    if not self.nearDoor then return nil end

    local w = self.width
    local toggleY = 55 + 5
    local playX = w/2 - 52
    local practiceX = w/2 + 2

    -- Check Play button
    if gx >= playX and gx <= playX + 50 and gy >= toggleY and gy <= toggleY + 16 then
        return "play"
    end

    -- Check Practice button
    if gx >= practiceX and gx <= practiceX + 50 and gy >= toggleY and gy <= toggleY + 16 then
        return "practice"
    end

    return nil
end

-- Check if chat input is clicked
function Sauna:isChatInputClicked(gx, gy)
    local x, y = 4, 268
    local w = self.width - 8 - 25 - 2  -- minus send button
    local h = 14

    return gx >= x and gx <= x + w and gy >= y and gy <= y + h
end

-- Check if send button is clicked
function Sauna:isSendButtonClicked(gx, gy)
    local sendX = self.width - 4 - 25
    local y = 268
    local h = 14

    return gx >= sendX and gx <= sendX + 25 and gy >= y and gy <= y + h
end

-- Check if menu button is clicked (top-left)
function Sauna:isMenuButtonClicked(gx, gy)
    return gx >= 4 and gx <= 32 and gy >= 4 and gy <= 18
end

-- Handle text input
function Sauna:handleTextInput(text)
    if self.chatInputActive and #self.chatInput < 50 then
        self.chatInput = self.chatInput .. text
    end
end

-- Handle key press for chat
function Sauna:handleKeyPressed(key)
    if self.chatInputActive then
        if key == "return" and #self.chatInput > 0 then
            -- Send message
            Bridge.sendChatMessage(self.chatInput)
            local senderName = Bridge.walletAddress and string.sub(Bridge.walletAddress, 1, 6) or "You"
            self:addChatMessage(senderName, self.chatInput, true)  -- Play sound for player messages
            self.chatInput = ""
            return true
        elseif key == "backspace" then
            self.chatInput = string.sub(self.chatInput, 1, -2)
            return true
        elseif key == "escape" then
            self.chatInputActive = false
            return true
        end
    end
    return false
end

-- Send chat message
function Sauna:sendChat()
    if #self.chatInput > 0 then
        Bridge.sendChatMessage(self.chatInput)
        local senderName = Bridge.walletAddress and string.sub(Bridge.walletAddress, 1, 6) or "You"
        self:addChatMessage(senderName, self.chatInput, true)  -- Play sound for player messages
        self.chatInput = ""
    end
end

return Sauna
