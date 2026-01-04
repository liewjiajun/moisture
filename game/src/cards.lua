-- Card System
-- Defines all upgrade cards and handles card selection UI
-- Focused on defense, movement, and bullet manipulation

local Cards = {}
Cards.__index = Cards

-- All available upgrade cards
Cards.DEFINITIONS = {
    -- DEFENSE
    heart = {
        id = "heart",
        name = "HEART",
        desc = "+1 max HP",
        icon = "♥",
        category = "defense",
        color = {1.0, 0.3, 0.3},
        maxLevel = 5,
        effect = "Increases maximum health"
    },
    tiny = {
        id = "tiny",
        name = "TINY",
        desc = "Smaller hitbox",
        icon = "·",
        category = "defense",
        color = {0.5, 1.0, 0.5},
        maxLevel = 5,
        effect = "Reduces your collision size by 10%"
    },
    ghost = {
        id = "ghost",
        name = "GHOST",
        desc = "Longer i-frames",
        icon = "G",
        category = "defense",
        color = {0.7, 0.7, 0.9},
        maxLevel = 3,
        effect = "More invincibility time after damage"
    },
    shield = {
        id = "shield",
        name = "SHIELD",
        desc = "Auto-block",
        icon = "O",
        category = "defense",
        color = {0.3, 0.7, 1.0},
        maxLevel = 3,
        effect = "Absorb 1 bullet every 8 seconds"
    },

    -- MOVEMENT
    swift = {
        id = "swift",
        name = "SWIFT",
        desc = "+15% speed",
        icon = "»",
        category = "movement",
        color = {0.3, 0.9, 1.0},
        maxLevel = 5,
        effect = "Move faster"
    },
    blink = {
        id = "blink",
        name = "BLINK",
        desc = "Teleport",
        icon = "↯",
        category = "movement",
        color = {1.0, 0.7, 0.3},
        maxLevel = 3,
        effect = "Short teleport with cooldown"
    },
    focus = {
        id = "focus",
        name = "FOCUS",
        desc = "Slow = tiny",
        icon = "◎",
        category = "movement",
        color = {1.0, 0.9, 0.3},
        maxLevel = 3,
        effect = "Smaller hitbox when moving slowly"
    },

    -- BULLET MANIPULATION
    reflect = {
        id = "reflect",
        name = "REFLECT",
        desc = "Bounce power",
        icon = "⟲",
        category = "bullet",
        color = {1.0, 0.5, 0.2},
        maxLevel = 5,
        effect = "Bounced bullets deal +50% damage"
    },
    repel = {
        id = "repel",
        name = "REPEL",
        desc = "Bullet curve",
        icon = "↺",
        category = "bullet",
        color = {0.9, 0.2, 0.6},
        maxLevel = 5,
        effect = "Bullets curve away from you"
    },
    freeze = {
        id = "freeze",
        name = "FREEZE",
        desc = "Slow bullets",
        icon = "❄",
        category = "bullet",
        color = {0.5, 0.8, 1.0},
        maxLevel = 5,
        effect = "Bullets slow down near you"
    },
    shrink = {
        id = "shrink",
        name = "SHRINK",
        desc = "Tiny bullets",
        icon = "↓",
        category = "bullet",
        color = {0.6, 0.9, 0.6},
        maxLevel = 3,
        effect = "Bullets get smaller near you"
    },

    -- UTILITY
    calm = {
        id = "calm",
        name = "CALM",
        desc = "Slow fire",
        icon = "~",
        category = "utility",
        color = {0.5, 0.5, 0.9},
        maxLevel = 5,
        effect = "Enemies shoot 15% slower"
    },
    chaos = {
        id = "chaos",
        name = "CHAOS",
        desc = "Bad aim",
        icon = "?",
        category = "utility",
        color = {0.9, 0.6, 0.2},
        maxLevel = 5,
        effect = "Enemy bullets spread randomly"
    },
}

-- Card selection state
function Cards.new()
    local self = setmetatable({}, Cards)

    self.active = false
    self.choices = {}
    self.selectedIndex = 0
    self.animTimer = 0

    -- Track upgrade levels
    self.levels = {}
    for id, _ in pairs(Cards.DEFINITIONS) do
        self.levels[id] = 0
    end

    return self
end

function Cards:getAvailableCards()
    local available = {}
    for id, def in pairs(Cards.DEFINITIONS) do
        if self.levels[id] < def.maxLevel then
            table.insert(available, def)
        end
    end
    return available
end

function Cards:generateChoices(count)
    local available = self:getAvailableCards()
    local choices = {}

    -- Shuffle and pick
    for i = #available, 2, -1 do
        local j = love.math.random(1, i)
        available[i], available[j] = available[j], available[i]
    end

    for i = 1, math.min(count, #available) do
        table.insert(choices, available[i])
    end

    return choices
end

function Cards:showSelection()
    self.choices = self:generateChoices(3)
    if #self.choices > 0 then
        self.active = true
        self.selectedIndex = 1
        self.animTimer = 0
    end
    return #self.choices > 0
end

function Cards:selectCard(index)
    if not self.active or index < 1 or index > #self.choices then
        return nil
    end

    local card = self.choices[index]
    self.levels[card.id] = self.levels[card.id] + 1
    self.active = false
    self.choices = {}

    return card
end

function Cards:getLevel(cardId)
    return self.levels[cardId] or 0
end

function Cards:update(dt)
    if self.active then
        self.animTimer = self.animTimer + dt
    end
end

function Cards:keypressed(key)
    if not self.active then return nil end

    if key == "left" or key == "a" then
        self.selectedIndex = self.selectedIndex - 1
        if self.selectedIndex < 1 then
            self.selectedIndex = #self.choices
        end
    elseif key == "right" or key == "d" then
        self.selectedIndex = self.selectedIndex + 1
        if self.selectedIndex > #self.choices then
            self.selectedIndex = 1
        end
    elseif key == "return" or key == "space" or key == "1" or key == "2" or key == "3" then
        local index = self.selectedIndex
        if key == "1" then index = 1
        elseif key == "2" then index = 2
        elseif key == "3" then index = 3
        end
        return self:selectCard(index)
    end

    return nil
end

function Cards:touchpressed(gx, gy, screenWidth, screenHeight)
    if not self.active then return nil end

    local cardWidth = 50
    local cardHeight = 70
    local spacing = 8
    local totalWidth = #self.choices * cardWidth + (#self.choices - 1) * spacing
    local startX = (screenWidth - totalWidth) / 2
    local cardY = screenHeight / 2 - cardHeight / 2

    for i, card in ipairs(self.choices) do
        local cardX = startX + (i - 1) * (cardWidth + spacing)

        if gx >= cardX and gx <= cardX + cardWidth and
           gy >= cardY and gy <= cardY + cardHeight then
            return self:selectCard(i)
        end
    end

    return nil
end

function Cards:draw(screenWidth, screenHeight)
    if not self.active or #self.choices == 0 then return end

    -- Dim background
    love.graphics.setColor(0, 0, 0, 0.7)
    love.graphics.rectangle("fill", 0, 0, screenWidth, screenHeight)

    -- Title
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.printf("CHOOSE UPGRADE", 0, screenHeight / 2 - 60, screenWidth, "center")

    -- Draw cards
    local cardWidth = 50
    local cardHeight = 70
    local spacing = 8
    local totalWidth = #self.choices * cardWidth + (#self.choices - 1) * spacing
    local startX = (screenWidth - totalWidth) / 2
    local cardY = screenHeight / 2 - cardHeight / 2

    for i, card in ipairs(self.choices) do
        local cardX = startX + (i - 1) * (cardWidth + spacing)
        local selected = (i == self.selectedIndex)

        -- Card bounce animation
        local bounce = 0
        if selected then
            bounce = math.sin(self.animTimer * 8) * 2
        end

        -- Card background
        local level = self.levels[card.id]
        if selected then
            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.rectangle("fill", cardX - 2, cardY - 2 + bounce, cardWidth + 4, cardHeight + 4)
        end

        love.graphics.setColor(0.15, 0.15, 0.2, 1)
        love.graphics.rectangle("fill", cardX, cardY + bounce, cardWidth, cardHeight)

        -- Card border (colored by category)
        love.graphics.setColor(card.color[1], card.color[2], card.color[3], 1)
        love.graphics.rectangle("line", cardX, cardY + bounce, cardWidth, cardHeight)
        love.graphics.rectangle("line", cardX + 1, cardY + 1 + bounce, cardWidth - 2, cardHeight - 2)

        -- Icon
        love.graphics.setColor(card.color[1], card.color[2], card.color[3], 1)
        love.graphics.printf(card.icon, cardX, cardY + 8 + bounce, cardWidth, "center")

        -- Name
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.printf(card.name, cardX, cardY + 25 + bounce, cardWidth, "center")

        -- Level indicator
        if level > 0 then
            love.graphics.setColor(1, 0.8, 0.2, 1)
            love.graphics.printf("Lv" .. level, cardX, cardY + 38 + bounce, cardWidth, "center")
        end

        -- Description
        love.graphics.setColor(0.7, 0.7, 0.7, 1)
        love.graphics.printf(card.desc, cardX, cardY + 52 + bounce, cardWidth, "center")

        -- Selection number
        love.graphics.setColor(0.5, 0.5, 0.5, 0.8)
        love.graphics.printf(tostring(i), cardX, cardY + cardHeight + 4 + bounce, cardWidth, "center")
    end

    -- Instructions
    love.graphics.setColor(0.6, 0.6, 0.6, 1)
    love.graphics.printf("TAP or 1/2/3 to select", 0, screenHeight / 2 + 55, screenWidth, "center")
end

function Cards:isActive()
    return self.active
end

return Cards
