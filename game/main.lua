-- INCREMENTAL TEST - Step 1: Just requires
print("[TEST] Starting with requires...")

local function safeRequire(name)
    print("[TEST] Requiring: " .. name)
    local success, result = pcall(require, name)
    if success then
        print("[TEST] Loaded: " .. name)
        return result
    else
        print("[TEST] FAILED: " .. name .. " - " .. tostring(result))
        return nil
    end
end

local PixelCanvas = safeRequire("src.pixelcanvas")
local Character = safeRequire("src.character")
local TouchControls = safeRequire("src.touchcontrols")
local Enemies = safeRequire("src.enemies")
local Bridge = safeRequire("src.bridge")
local Cards = safeRequire("src.cards")
local Upgrades = safeRequire("src.upgrades")
local Sauna = safeRequire("src.sauna")
local Sounds = safeRequire("src.sounds")

print("[TEST] All requires done")

function love.load()
    print("[TEST] love.load called")
end

function love.update(dt)
    print("[TEST] love.update called")
end

function love.draw()
    print("[TEST] love.draw called")
    love.graphics.clear(0, 1, 0)  -- Green screen = requires work
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Requires loaded OK!", 100, 100)
end
