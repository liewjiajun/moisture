-- INCREMENTAL TEST - Step 4: Cards, Upgrades, Sauna
print("[TEST] Starting...")

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

local pixelCanvas
local touchControls
local player
local cards
local upgrades
local sauna

function love.load()
    print("[TEST] love.load called")

    print("[TEST] Creating PixelCanvas...")
    pixelCanvas = PixelCanvas.new()
    print("[TEST] PixelCanvas created")

    print("[TEST] Creating TouchControls...")
    touchControls = TouchControls.new(pixelCanvas)
    print("[TEST] TouchControls created")

    print("[TEST] Skipping Sounds.load()")

    print("[TEST] Creating player character...")
    player = {
        x = 90,
        y = 250,
        character = Character.new(12345),
    }
    print("[TEST] Player created")

    print("[TEST] Creating Cards...")
    cards = Cards.new()
    print("[TEST] Cards created")

    print("[TEST] Creating Upgrades...")
    upgrades = Upgrades.new()
    print("[TEST] Upgrades created")

    print("[TEST] Creating Sauna...")
    sauna = Sauna.new(pixelCanvas)
    print("[TEST] Sauna created")

    print("[TEST] love.load complete!")
end

function love.update(dt)
    -- Nothing yet
end

function love.draw()
    love.graphics.clear(1, 1, 0)  -- Yellow = Step 4 works
    love.graphics.setColor(0, 0, 0)
    love.graphics.print("Cards + Upgrades + Sauna OK!", 10, 100)
end
