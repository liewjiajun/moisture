-- Procedural Enemy Generator
-- Generates unique anime-style humanoid enemies from a seed
-- No hard-coded sprites - all features are mathematically derived

local Enemies = {}

-- Seeded random number generator
local function createRNG(seed)
    local state = seed
    return function()
        state = (state * 1103515245 + 12345) % 2147483648
        return state / 2147483648
    end
end

-- Generate a color from HSV
local function hsvToRgb(h, s, v)
    local r, g, b
    local i = math.floor(h * 6)
    local f = h * 6 - i
    local p = v * (1 - s)
    local q = v * (1 - f * s)
    local t = v * (1 - (1 - f) * s)
    i = i % 6
    if i == 0 then r, g, b = v, t, p
    elseif i == 1 then r, g, b = q, v, p
    elseif i == 2 then r, g, b = p, v, t
    elseif i == 3 then r, g, b = p, q, v
    elseif i == 4 then r, g, b = t, p, v
    elseif i == 5 then r, g, b = v, p, q
    end
    return {math.floor(r * 255), math.floor(g * 255), math.floor(b * 255)}
end

-- Enemy type definitions (base characteristics)
local ENEMY_TYPES = {
    fairy = {
        baseHue = 0.85, hueRange = 0.15,
        saturation = {0.4, 0.7}, brightness = {0.7, 0.9},
        hasWings = true, bodyStyle = "small",
    },
    slime = {
        baseHue = 0.35, hueRange = 0.3,
        saturation = {0.5, 0.8}, brightness = {0.5, 0.8},
        bodyStyle = "blob", transparent = true,
    },
    bunny = {
        baseHue = 0.95, hueRange = 0.1,
        saturation = {0.2, 0.5}, brightness = {0.8, 0.95},
        hasTail = true, hasEars = "bunny", bodyStyle = "small",
    },
    neko = {
        baseHue = 0.08, hueRange = 0.15,
        saturation = {0.3, 0.6}, brightness = {0.5, 0.8},
        hasTail = true, hasEars = "cat", bodyStyle = "small",
    },
    witch = {
        baseHue = 0.75, hueRange = 0.1,
        saturation = {0.4, 0.7}, brightness = {0.3, 0.5},
        hasHat = true, bodyStyle = "robed",
    },
    miko = {
        baseHue = 0.0, hueRange = 0.05,
        saturation = {0.6, 0.8}, brightness = {0.7, 0.9},
        bodyStyle = "robed",
    },
    ghost = {
        baseHue = 0.6, hueRange = 0.1,
        saturation = {0.1, 0.3}, brightness = {0.8, 0.95},
        bodyStyle = "ghostly", transparent = true,
    },
    demon = {
        baseHue = 0.0, hueRange = 0.08,
        saturation = {0.6, 0.9}, brightness = {0.3, 0.5},
        hasWings = true, hasTail = true, hasHorns = true, bodyStyle = "normal",
    },
    kitsune = {
        baseHue = 0.08, hueRange = 0.08,
        saturation = {0.5, 0.8}, brightness = {0.6, 0.85},
        hasTail = true, hasEars = "fox", bodyStyle = "elegant",
    },
    angel = {
        baseHue = 0.15, hueRange = 0.1,
        saturation = {0.2, 0.5}, brightness = {0.85, 1.0},
        hasWings = true, hasHalo = true, bodyStyle = "elegant",
    },
}

-- Generate procedural colors for an enemy
local function generateEnemyColors(rng, typeConfig)
    local hue = typeConfig.baseHue + (rng() - 0.5) * typeConfig.hueRange
    hue = hue % 1

    local sat = typeConfig.saturation[1] + rng() * (typeConfig.saturation[2] - typeConfig.saturation[1])
    local val = typeConfig.brightness[1] + rng() * (typeConfig.brightness[2] - typeConfig.brightness[1])

    local mainColor = hsvToRgb(hue, sat, val)
    local shadowColor = hsvToRgb(hue, math.min(1, sat + 0.15), val * 0.7)
    local highlightColor = hsvToRgb(hue, sat * 0.7, math.min(1, val * 1.15))

    local secondaryHue = (hue + 0.3 + rng() * 0.4) % 1
    local secondaryColor = hsvToRgb(secondaryHue, sat * 0.8, val * 0.9)
    local secondaryShadow = hsvToRgb(secondaryHue, math.min(1, sat * 0.8 + 0.15), val * 0.7)

    local skinHue = 0.08 + rng() * 0.04
    local skinSat = 0.2 + rng() * 0.3
    local skinVal = 0.6 + rng() * 0.3
    local skinColor = hsvToRgb(skinHue, skinSat, skinVal)
    local skinShadow = hsvToRgb(skinHue, skinSat + 0.1, skinVal * 0.8)

    return {
        main = mainColor, shadow = shadowColor, highlight = highlightColor,
        secondary = secondaryColor, secondaryShadow = secondaryShadow,
        skin = skinColor, skinShadow = skinShadow,
    }
end

-- Generate a procedural enemy sprite
function Enemies.generateSprite(enemyType, seed)
    seed = seed or love.math.random(1, 999999)
    local rng = createRNG(seed)

    local typeConfig = ENEMY_TYPES[enemyType] or ENEMY_TYPES.fairy
    local colors = generateEnemyColors(rng, typeConfig)

    -- Wrap canvas operations in pcall for Love.js compatibility
    local sprite = nil
    local success, err = pcall(function()
        sprite = love.graphics.newCanvas(10, 12)
        sprite:setFilter("nearest", "nearest")

        love.graphics.setCanvas(sprite)
        love.graphics.clear(0, 0, 0, 0)

    local alpha = typeConfig.transparent and 0.8 or 1

    local function setCol(c, a)
        love.graphics.setColor(c[1]/255, c[2]/255, c[3]/255, a or alpha)
    end

    -- Draw based on body style
    if typeConfig.bodyStyle == "blob" then
        setCol(colors.main)
        love.graphics.rectangle("fill", 2, 6, 6, 5)
        love.graphics.rectangle("fill", 3, 4, 4, 2)
        setCol(colors.shadow)
        love.graphics.rectangle("fill", 2, 9, 6, 2)
        love.graphics.setColor(0, 0, 0, alpha)
        love.graphics.rectangle("fill", 3, 6, 1, 1)
        love.graphics.rectangle("fill", 6, 6, 1, 1)
        setCol(colors.highlight, 0.5)
        love.graphics.rectangle("fill", 3, 5, 2, 1)
    elseif typeConfig.bodyStyle == "ghostly" then
        setCol(colors.main)
        love.graphics.rectangle("fill", 2, 2, 6, 6)
        love.graphics.rectangle("fill", 1, 4, 8, 4)
        love.graphics.rectangle("fill", 2, 8, 2, 2)
        love.graphics.rectangle("fill", 6, 8, 2, 2)
        love.graphics.rectangle("fill", 4, 9, 2, 2)
        love.graphics.setColor(0, 0, 0, alpha)
        love.graphics.rectangle("fill", 3, 4, 1, 2)
        love.graphics.rectangle("fill", 6, 4, 1, 2)
    elseif typeConfig.bodyStyle == "robed" then
        setCol(colors.skin)
        love.graphics.rectangle("fill", 3, 3, 4, 4)
        setCol(colors.main)
        love.graphics.rectangle("fill", 2, 7, 6, 4)
        love.graphics.rectangle("fill", 1, 8, 8, 3)
        setCol(colors.shadow)
        love.graphics.rectangle("fill", 2, 10, 6, 1)
        if typeConfig.hasHat then
            setCol(colors.secondary)
            love.graphics.rectangle("fill", 2, 2, 6, 2)
            love.graphics.rectangle("fill", 3, 0, 4, 2)
            love.graphics.rectangle("fill", 4, -1, 2, 1)
        end
        love.graphics.setColor(0, 0, 0, 1)
        love.graphics.rectangle("fill", 3, 4, 1, 1)
        love.graphics.rectangle("fill", 6, 4, 1, 1)
    elseif typeConfig.bodyStyle == "elegant" then
        setCol(colors.main)
        love.graphics.rectangle("fill", 2, 0, 6, 3)
        love.graphics.rectangle("fill", 1, 1, 8, 2)
        setCol(colors.skin)
        love.graphics.rectangle("fill", 3, 2, 4, 4)
        setCol(colors.secondary)
        love.graphics.rectangle("fill", 3, 6, 4, 4)
        love.graphics.rectangle("fill", 2, 7, 6, 3)
        setCol(colors.skin)
        love.graphics.rectangle("fill", 3, 10, 1, 2)
        love.graphics.rectangle("fill", 6, 10, 1, 2)
        love.graphics.setColor(0, 0, 0, 1)
        love.graphics.rectangle("fill", 3, 4, 1, 1)
        love.graphics.rectangle("fill", 6, 4, 1, 1)
    else
        -- Normal/small body
        setCol(colors.main)
        love.graphics.rectangle("fill", 2, 0, 6, 3)
        love.graphics.rectangle("fill", 1, 1, 8, 2)
        setCol(colors.skin)
        love.graphics.rectangle("fill", 3, 2, 4, 4)
        setCol(colors.skinShadow)
        love.graphics.rectangle("fill", 3, 5, 4, 1)
        setCol(colors.secondary)
        love.graphics.rectangle("fill", 3, 6, 4, 4)
        setCol(colors.secondaryShadow)
        love.graphics.rectangle("fill", 3, 9, 4, 1)
        setCol(colors.skin)
        love.graphics.rectangle("fill", 3, 10, 1, 2)
        love.graphics.rectangle("fill", 6, 10, 1, 2)
        love.graphics.setColor(0, 0, 0, 1)
        love.graphics.rectangle("fill", 3, 4, 1, 1)
        love.graphics.rectangle("fill", 6, 4, 1, 1)
    end

    -- Wings
    if typeConfig.hasWings then
        if enemyType == "demon" then
            setCol(colors.shadow)
        else
            setCol(colors.highlight, 0.7)
        end
        love.graphics.rectangle("fill", 0, 4, 2, 3)
        love.graphics.rectangle("fill", 8, 4, 2, 3)
    end

    -- Ears
    if typeConfig.hasEars then
        setCol(colors.main)
        if typeConfig.hasEars == "bunny" then
            love.graphics.rectangle("fill", 2, -2, 1, 3)
            love.graphics.rectangle("fill", 7, -2, 1, 3)
        else
            love.graphics.rectangle("fill", 1, 0, 2, 2)
            love.graphics.rectangle("fill", 7, 0, 2, 2)
        end
    end

    -- Tail
    if typeConfig.hasTail then
        setCol(colors.main)
        love.graphics.rectangle("fill", 8, 8, 2, 1)
        love.graphics.rectangle("fill", 9, 9, 1, 1)
    end

    -- Horns
    if typeConfig.hasHorns then
        love.graphics.setColor(0.3, 0.2, 0.2, 1)
        love.graphics.rectangle("fill", 1, 0, 1, 2)
        love.graphics.rectangle("fill", 8, 0, 1, 2)
    end

    -- Halo
    if typeConfig.hasHalo then
        love.graphics.setColor(1, 1, 0.7, 0.8)
        love.graphics.rectangle("fill", 3, -1, 4, 1)
    end

        love.graphics.setCanvas()
    end)

    if not success then
        print("[Enemies] Sprite generation failed:", err)
        return nil
    end

    return sprite
end

function Enemies.getTypes()
    return {"fairy", "slime", "bunny", "neko", "witch", "miko", "ghost", "demon", "kitsune", "angel"}
end

function Enemies.getRandomType(humidity)
    if humidity < 1.5 then
        local easyTypes = {"fairy", "slime", "bunny"}
        return easyTypes[love.math.random(1, #easyTypes)]
    elseif humidity < 2.5 then
        local mediumTypes = {"fairy", "slime", "bunny", "neko", "witch", "miko"}
        return mediumTypes[love.math.random(1, #mediumTypes)]
    elseif humidity < 3.5 then
        local hardTypes = {"fairy", "neko", "witch", "miko", "ghost", "demon", "kitsune"}
        return hardTypes[love.math.random(1, #hardTypes)]
    else
        local types = Enemies.getTypes()
        return types[love.math.random(1, #types)]
    end
end

function Enemies.getStats(enemyType)
    local stats = {
        fairy = {speed = 20, health = 1, damage = 1, shootRate = 2.5, points = 10},
        slime = {speed = 15, health = 2, damage = 1, shootRate = 3.0, points = 15, splits = true},
        bunny = {speed = 35, health = 1, damage = 1, shootRate = 2.0, points = 12},
        neko = {speed = 40, health = 1, damage = 1, shootRate = 1.8, points = 18},
        witch = {speed = 18, health = 2, damage = 1, shootRate = 1.5, points = 25},
        miko = {speed = 22, health = 2, damage = 1, shootRate = 2.0, points = 20},
        ghost = {speed = 25, health = 1, damage = 1, shootRate = 1.2, points = 30, phasing = true},
        demon = {speed = 28, health = 3, damage = 1, shootRate = 1.0, points = 35},
        kitsune = {speed = 30, health = 2, damage = 1, shootRate = 0.8, points = 40, multishot = true},
        angel = {speed = 20, health = 4, damage = 1, shootRate = 0.5, points = 50, homing = true},
    }
    return stats[enemyType] or stats.fairy
end

function Enemies.getName(enemyType)
    local names = {
        fairy = "Fairy", slime = "Slime", bunny = "Bunny", neko = "Neko",
        witch = "Witch", miko = "Miko", ghost = "Ghost", demon = "Demon",
        kitsune = "Kitsune", angel = "Angel",
    }
    return names[enemyType] or "Enemy"
end

return Enemies
