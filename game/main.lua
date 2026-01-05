-- INCREMENTAL TEST - Step 3b: Skip Sounds
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

function love.load()
    print("[TEST] love.load called")

    print("[TEST] Creating PixelCanvas...")
    pixelCanvas = PixelCanvas.new()
    print("[TEST] PixelCanvas created")

    print("[TEST] Creating TouchControls...")
    touchControls = TouchControls.new(pixelCanvas)
    print("[TEST] TouchControls created")

    -- SKIP SOUNDS - they cause issues with missing files
    print("[TEST] Skipping Sounds.load()")

    print("[TEST] Creating player character...")
    player = {
        x = 90,
        y = 250,
        sprite = Character.generate(12345),
    }
    print("[TEST] Player created: " .. tostring(player.sprite))

    print("[TEST] love.load complete")
end

function love.update(dt)
    -- Just log first frame
end

function love.draw()
    love.graphics.clear(1, 0, 1)  -- Magenta = Step 3b works
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("No Sounds - Character OK!", 10, 100)
end
