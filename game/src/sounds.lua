-- Sound Effects Module
-- Handles loading and playing game sounds with graceful fallbacks

local Sounds = {}

-- Sound configuration
Sounds.config = {
    masterVolume = 0.7,
    sfxVolume = 1.0,
    enabled = true,
}

-- Sound sources (loaded lazily)
Sounds.sources = {}

-- Sound definitions with paths and default volumes
Sounds.definitions = {
    shoot = { path = "assets/sounds/shoot.wav", volume = 0.3, variants = 1 },
    bounce = { path = "assets/sounds/bounce.wav", volume = 0.5, variants = 1 },
    hit = { path = "assets/sounds/hit.wav", volume = 0.8, variants = 1 },
    death = { path = "assets/sounds/death.wav", volume = 1.0, variants = 1 },
    pickup = { path = "assets/sounds/pickup.wav", volume = 0.6, variants = 1 },
    countdown = { path = "assets/sounds/countdown.wav", volume = 0.7, variants = 1 },
    go = { path = "assets/sounds/go.wav", volume = 0.8, variants = 1 },
    click = { path = "assets/sounds/click.wav", volume = 0.4, variants = 1 },
    door = { path = "assets/sounds/door.wav", volume = 0.5, variants = 1 },
    chat = { path = "assets/sounds/chat.wav", volume = 0.3, variants = 1 },
}

-- Load a single sound (returns nil and error if file doesn't exist)
local function loadSound(path)
    -- Skip getInfo check - doesn't work reliably in Love.js
    -- Just try to load and let pcall handle errors
    local success, result = pcall(function()
        return love.audio.newSource(path, "static")
    end)
    if success and result then
        return result, nil
    end
    return nil, tostring(result)
end

-- Initialize sounds (call in love.load)
function Sounds.load()
    print("[Sounds] ========================================")
    print("[Sounds] Loading sound effects...")
    print("[Sounds] Audio device info:")

    -- Try to get audio device info
    pcall(function()
        local count = love.audio.getActiveSourceCount and love.audio.getActiveSourceCount() or "N/A"
        print("[Sounds]   Active sources: " .. tostring(count))
    end)

    local loadedCount = 0
    local failedCount = 0

    for name, def in pairs(Sounds.definitions) do
        local source, err = loadSound(def.path)
        if source then
            Sounds.sources[name] = source
            loadedCount = loadedCount + 1
            print("[Sounds] OK: " .. name)
        else
            failedCount = failedCount + 1
            print("[Sounds] FAILED: " .. name .. " - " .. (err or "unknown error"))
        end
    end

    print("[Sounds] ========================================")
    print("[Sounds] Loaded: " .. loadedCount .. ", Failed: " .. failedCount)
    print("[Sounds] ========================================")
end

-- Play a sound effect
function Sounds.play(name, volumeOverride, pitchOverride)
    if not Sounds.config.enabled then return end

    local source = Sounds.sources[name]
    if not source then return end

    local def = Sounds.definitions[name]
    local volume = (volumeOverride or def.volume) * Sounds.config.sfxVolume * Sounds.config.masterVolume

    -- Wrap audio operations in pcall for Love.js compatibility
    local success, clone = pcall(function()
        local c = source:clone()
        c:setVolume(volume)
        -- Skip setPitch if not supported (Love.js/WebAudio limitation)
        if pitchOverride and pitchOverride ~= 1.0 then
            pcall(function() c:setPitch(pitchOverride) end)
        end
        c:play()
        return c
    end)

    return success and clone or nil
end

-- Play with random pitch variation (for variety)
function Sounds.playVaried(name, volumeOverride, pitchRange)
    local range = pitchRange or 0.1
    local pitch = 1.0 + (love.math.random() - 0.5) * range * 2
    return Sounds.play(name, volumeOverride, pitch)
end

-- Stop all sounds
function Sounds.stopAll()
    for name, source in pairs(Sounds.sources) do
        source:stop()
    end
end

-- Set master volume (0-1)
function Sounds.setMasterVolume(volume)
    Sounds.config.masterVolume = math.max(0, math.min(1, volume))
end

-- Toggle sounds on/off
function Sounds.toggle()
    Sounds.config.enabled = not Sounds.config.enabled
    if not Sounds.config.enabled then
        Sounds.stopAll()
    end
    return Sounds.config.enabled
end

-- Check if sounds are enabled
function Sounds.isEnabled()
    return Sounds.config.enabled
end

return Sounds
