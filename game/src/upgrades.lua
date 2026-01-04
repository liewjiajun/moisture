-- Upgrade Effects System
-- Handles all active upgrade effects during gameplay
-- Focused on defense, movement, and bullet manipulation

local Upgrades = {}
Upgrades.__index = Upgrades

function Upgrades.new()
    local self = setmetatable({}, Upgrades)

    -- Shield cooldown
    self.shieldTimer = 0
    self.shieldReady = false
    self.shieldFlash = 0

    -- Blink cooldown
    self.blinkCooldown = 0
    self.blinkReady = false

    -- Invincibility frames
    self.iFrames = 0

    -- Focus (slow movement) detection
    self.moveSpeed = 0

    -- Visual effects
    self.repelPulse = 0
    self.freezeRadius = 0

    return self
end

function Upgrades:update(dt, playerX, playerY, isMoving, moveSpeed, levels)
    -- Shield recharge
    if levels.shield > 0 then
        local shieldCooldown = 10 - levels.shield * 2  -- 8s, 6s, 4s
        self.shieldTimer = self.shieldTimer + dt
        if self.shieldTimer >= shieldCooldown then
            self.shieldReady = true
        end
        if self.shieldFlash > 0 then
            self.shieldFlash = self.shieldFlash - dt
        end
    end

    -- Blink recharge
    if levels.blink > 0 then
        local blinkCooldown = 5 - levels.blink  -- 4s, 3s, 2s
        if self.blinkCooldown > 0 then
            self.blinkCooldown = self.blinkCooldown - dt
        end
        self.blinkReady = self.blinkCooldown <= 0
    end

    -- Invincibility frames countdown
    if self.iFrames > 0 then
        self.iFrames = self.iFrames - dt
    end

    -- Focus tracking
    self.moveSpeed = moveSpeed

    -- Visual pulses
    if levels.repel > 0 then
        self.repelPulse = self.repelPulse + dt * 3
    end
    if levels.freeze > 0 then
        self.freezeRadius = 25 + levels.freeze * 10
    end
end

-- Defense helpers
function Upgrades:getHitboxMultiplier(levels, isMovingSlow)
    local mult = 1.0

    -- Tiny upgrade - more noticeable effect
    if levels.tiny > 0 then
        mult = mult - levels.tiny * 0.15  -- 15% per level (more noticeable)
    end

    -- Focus upgrade (smaller when moving slow)
    if levels.focus > 0 and isMovingSlow then
        mult = mult - levels.focus * 0.15
    end

    return math.max(0.25, mult)  -- Minimum 25% size
end

function Upgrades:getIFrameDuration(levels)
    local base = 0.5
    if levels.ghost > 0 then
        base = base + levels.ghost * 0.3  -- +0.3s per level
    end
    return base
end

function Upgrades:tryAbsorbBullet(levels)
    if levels.shield > 0 and self.shieldReady then
        self.shieldReady = false
        self.shieldTimer = 0
        self.shieldFlash = 0.3
        return true
    end
    return false
end

function Upgrades:isInvincible(levels, isMoving)
    -- I-frames active
    if self.iFrames > 0 then
        return true
    end

    return false
end

function Upgrades:triggerIFrames(levels)
    self.iFrames = self:getIFrameDuration(levels)
end

-- Movement helpers
function Upgrades:getSpeedMultiplier(levels)
    return 1 + levels.swift * 0.15  -- 15% per level
end

function Upgrades:tryBlink(levels, dx, dy, playerX, playerY, screenW, screenH)
    if levels.blink > 0 and self.blinkReady then
        self.blinkReady = false
        self.blinkCooldown = 5 - levels.blink

        -- Blink distance
        local dist = 25 + levels.blink * 10  -- 35, 45, 55 pixels

        -- Normalize direction
        local len = math.sqrt(dx * dx + dy * dy)
        if len > 0 then
            dx, dy = dx / len, dy / len
        else
            dx, dy = 0, -1  -- Default up
        end

        local newX = playerX + dx * dist
        local newY = playerY + dy * dist

        -- Clamp to screen
        newX = math.max(8, math.min(screenW - 8, newX))
        newY = math.max(8, math.min(screenH - 8, newY))

        return true, newX, newY
    end
    return false, playerX, playerY
end

-- Bullet manipulation helpers
function Upgrades:getBulletDamageMultiplier(levels, hasBounced)
    if hasBounced and levels.reflect > 0 then
        return 1 + levels.reflect * 0.5  -- +50% per level
    end
    return 1
end

function Upgrades:getRepelStrength(levels)
    return levels.repel * 15  -- Repel force per level
end

function Upgrades:getFreezeRange(levels)
    if levels.freeze > 0 then
        return 25 + levels.freeze * 10
    end
    return 0
end

function Upgrades:getFreezeStrength(levels)
    return levels.freeze * 0.15  -- 15% slow per level
end

function Upgrades:getShrinkRange(levels)
    if levels.shrink > 0 then
        return 40 + levels.shrink * 15  -- Larger range for better effect
    end
    return 0
end

function Upgrades:getShrinkAmount(levels)
    return levels.shrink * 0.25  -- 25% smaller per level (more noticeable)
end

-- Utility helpers
function Upgrades:getEnemyFireRateMultiplier(levels)
    -- Higher = slower fire rate (divide by this)
    return 1 + levels.calm * 0.15
end

function Upgrades:getChaosSpread(levels)
    -- Radians of random spread
    return levels.chaos * 0.2
end

function Upgrades:getExtraHP(levels)
    return levels.heart
end

-- Drawing
function Upgrades:draw(playerX, playerY, levels, gameTime)
    -- Shield indicator
    if levels.shield > 0 then
        if self.shieldReady then
            -- Ready shield glow
            love.graphics.setColor(0.3, 0.7, 1.0, 0.3 + math.sin(gameTime * 4) * 0.2)
            love.graphics.circle("line", playerX, playerY, 12)
        elseif self.shieldFlash > 0 then
            -- Shield absorbed flash
            love.graphics.setColor(0.3, 0.7, 1.0, self.shieldFlash * 2)
            love.graphics.circle("fill", playerX, playerY, 15)
        end
    end

    -- Repel field
    if levels.repel > 0 then
        local radius = 20 + levels.repel * 5
        local pulse = math.sin(self.repelPulse) * 0.1 + 0.15
        love.graphics.setColor(0.9, 0.2, 0.6, pulse)
        love.graphics.circle("line", playerX, playerY, radius)
    end

    -- Freeze field
    if levels.freeze > 0 then
        local radius = self.freezeRadius
        love.graphics.setColor(0.5, 0.8, 1.0, 0.1)
        love.graphics.circle("fill", playerX, playerY, radius)
        love.graphics.setColor(0.5, 0.8, 1.0, 0.3)
        love.graphics.circle("line", playerX, playerY, radius)
    end

    -- Blink cooldown indicator
    if levels.blink > 0 and self.blinkCooldown > 0 then
        local maxCd = 5 - levels.blink
        local pct = self.blinkCooldown / maxCd
        love.graphics.setColor(1, 0.7, 0.3, 0.5)
        love.graphics.arc("fill", playerX, playerY + 14, 4, 0, math.pi * 2 * (1 - pct))
    end

    -- I-frames flash
    if self.iFrames > 0 then
        love.graphics.setColor(1, 1, 1, math.sin(gameTime * 20) * 0.3 + 0.3)
        love.graphics.circle("line", playerX, playerY, 8)
    end
end

function Upgrades:drawUI(screenWidth, screenHeight, levels)
    -- Draw active upgrade icons at top
    local iconSize = 10
    local padding = 2
    local x = padding
    local y = padding

    local activeUpgrades = {}
    for id, level in pairs(levels) do
        if level > 0 then
            table.insert(activeUpgrades, {id = id, level = level})
        end
    end

    for _, upgrade in ipairs(activeUpgrades) do
        local def = require("src.cards").DEFINITIONS[upgrade.id]
        if def then
            -- Background
            love.graphics.setColor(0, 0, 0, 0.5)
            love.graphics.rectangle("fill", x, y, iconSize, iconSize)

            -- Colored border
            love.graphics.setColor(def.color[1], def.color[2], def.color[3], 1)
            love.graphics.rectangle("line", x, y, iconSize, iconSize)

            -- Level number
            love.graphics.setColor(1, 1, 1, 1)
            love.graphics.print(tostring(upgrade.level), x + 2, y + 1)

            x = x + iconSize + padding
        end
    end
end

return Upgrades
