-- Procedural Character Generator
-- Generates unique humanoid pixel characters from a seed (wallet address)
-- No hard-coded components - all features are mathematically derived

local Character = {}
Character.__index = Character

-- Seeded random number generator
local function createRNG(seed)
    local state = seed
    return function()
        -- Simple LCG for deterministic random numbers
        state = (state * 1103515245 + 12345) % 2147483648
        return state / 2147483648
    end
end

-- Hash a string to a number (for wallet addresses)
local function hashString(str)
    local hash = 5381
    for i = 1, #str do
        hash = ((hash * 33) + string.byte(str, i)) % 2147483648
    end
    return hash
end

-- Generate a color from HSV with procedural variations
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

-- Generate skin tone procedurally (warm tones)
local function generateSkinTone(rng)
    -- Skin tones range from light to dark with warm undertones
    local lightness = 0.4 + rng() * 0.5  -- 0.4 to 0.9
    local warmth = 0.02 + rng() * 0.08   -- Hue variation (orange-red range)
    local saturation = 0.2 + rng() * 0.4

    local baseHue = 0.08 + warmth  -- Around orange/peach
    local base = hsvToRgb(baseHue, saturation, lightness)
    local shadow = hsvToRgb(baseHue, saturation + 0.1, lightness * 0.8)
    local highlight = hsvToRgb(baseHue, saturation * 0.7, math.min(1, lightness * 1.1))

    return {base, shadow, highlight}
end

-- Generate hair color procedurally
local function generateHairColor(rng)
    local colorType = rng()
    local h, s, v

    if colorType < 0.5 then
        -- Natural colors (browns, blacks, blondes, reds)
        if rng() < 0.3 then
            -- Blonde
            h = 0.1 + rng() * 0.05
            s = 0.3 + rng() * 0.3
            v = 0.7 + rng() * 0.25
        elseif rng() < 0.5 then
            -- Brown
            h = 0.05 + rng() * 0.05
            s = 0.4 + rng() * 0.3
            v = 0.2 + rng() * 0.4
        elseif rng() < 0.7 then
            -- Black
            h = rng()
            s = 0.1 + rng() * 0.2
            v = 0.1 + rng() * 0.15
        else
            -- Red
            h = 0.02 + rng() * 0.04
            s = 0.6 + rng() * 0.3
            v = 0.4 + rng() * 0.3
        end
    else
        -- Fantasy colors (any hue)
        h = rng()
        s = 0.5 + rng() * 0.5
        v = 0.5 + rng() * 0.4
    end

    local base = hsvToRgb(h, s, v)
    local shadow = hsvToRgb(h, math.min(1, s + 0.1), v * 0.7)

    return {base, shadow}
end

-- Generate clothing color procedurally
local function generateClothingColor(rng)
    local h = rng()
    local s = 0.3 + rng() * 0.6
    local v = 0.4 + rng() * 0.5

    local base = hsvToRgb(h, s, v)
    local shadow = hsvToRgb(h, math.min(1, s + 0.15), v * 0.75)

    return {base, shadow}
end

-- Generate eye color procedurally
local function generateEyeColor(rng)
    local colorType = rng()
    local h, s, v

    if colorType < 0.4 then
        -- Brown/amber
        h = 0.05 + rng() * 0.08
        s = 0.5 + rng() * 0.4
        v = 0.3 + rng() * 0.4
    elseif colorType < 0.6 then
        -- Blue
        h = 0.55 + rng() * 0.1
        s = 0.5 + rng() * 0.4
        v = 0.5 + rng() * 0.4
    elseif colorType < 0.75 then
        -- Green
        h = 0.3 + rng() * 0.1
        s = 0.4 + rng() * 0.4
        v = 0.4 + rng() * 0.4
    else
        -- Fantasy (any color)
        h = rng()
        s = 0.6 + rng() * 0.4
        v = 0.6 + rng() * 0.3
    end

    return hsvToRgb(h, s, v)
end

-- Generate procedural hair shape (8x4 bitmap)
local function generateHairStyle(rng)
    local style = {}
    local hairType = math.floor(rng() * 6)  -- Different base types

    for y = 1, 4 do
        style[y] = {}
        for x = 1, 8 do
            local hasHair = false

            if hairType == 0 then
                -- Short spiky
                hasHair = y <= 2 and x >= 2 and x <= 7
                if y == 1 and (x == 2 or x == 7) then hasHair = rng() > 0.5 end
            elseif hairType == 1 then
                -- Medium with bangs
                hasHair = (y <= 3 and x >= 2 and x <= 7) or (y == 4 and (x <= 2 or x >= 7))
            elseif hairType == 2 then
                -- Long flowing
                hasHair = x >= 1 and x <= 8 and (y <= 3 or (y == 4 and (x <= 2 or x >= 7)))
            elseif hairType == 3 then
                -- Ponytail style
                hasHair = (y <= 2 and x >= 2 and x <= 7) or (y >= 3 and x >= 6)
            elseif hairType == 4 then
                -- Twin tails
                hasHair = (y <= 2 and x >= 2 and x <= 7) or (y >= 3 and (x <= 2 or x >= 7))
            else
                -- Procedural random with symmetry
                local center = 4.5
                local dist = math.abs(x - center)
                local threshold = 0.3 + (1 - y/4) * 0.5 - dist * 0.1
                hasHair = rng() < threshold
            end

            -- Add some randomness
            if hasHair and rng() < 0.1 then hasHair = false end
            if not hasHair and rng() < 0.05 then hasHair = true end

            style[y][x] = hasHair and 1 or 0
        end
    end

    -- Ensure symmetry option
    if rng() < 0.7 then
        for y = 1, 4 do
            for x = 1, 4 do
                style[y][9-x] = style[y][x]
            end
        end
    end

    return style
end

-- Generate procedural eye style
local function generateEyeStyle(rng)
    local styles = {"normal", "anime", "cat", "happy", "determined", "sparkle"}
    return styles[math.floor(rng() * #styles) + 1]
end

-- Generate procedural shirt pattern
local function generateShirtStyle(rng)
    local styles = {"plain", "stripes_h", "stripes_v", "dots", "collar", "plain"}
    return styles[math.floor(rng() * #styles) + 1]
end

-- Generate procedural pants style
local function generatePantsStyle(rng)
    local styles = {"pants", "shorts", "skirt_short", "skirt_long", "pants"}
    return styles[math.floor(rng() * #styles) + 1]
end

-- Generate accessory procedurally
local function generateAccessory(rng)
    if rng() < 0.6 then return nil end  -- 40% have accessories
    local types = {"bow", "ribbon", "headband", "flower", "star", "horn", "cat_ears", "halo"}
    return types[math.floor(rng() * #types) + 1]
end

function Character.new(seed)
    local self = setmetatable({}, Character)

    -- Convert seed to number if it's a string (wallet address)
    if type(seed) == "string" then
        self.seed = hashString(seed)
    else
        self.seed = seed or os.time()
    end

    -- Create seeded RNG
    local rng = createRNG(self.seed)

    -- Generate all features procedurally
    self.skinTone = generateSkinTone(rng)
    self.hairColor = generateHairColor(rng)
    self.hairStyle = generateHairStyle(rng)
    self.shirtColor = generateClothingColor(rng)
    self.pantsColor = generateClothingColor(rng)
    self.eyeColor = generateEyeColor(rng)
    self.eyeStyle = generateEyeStyle(rng)
    self.shirtStyle = generateShirtStyle(rng)
    self.pantsStyle = generatePantsStyle(rng)
    self.accessory = generateAccessory(rng)

    -- Animation state
    self.animTimer = 0
    self.walkCycle = 0
    self.frame = 1

    -- Generate sprite sheet
    self:generateSprites()

    return self
end

function Character:generateSprites()
    -- Create sprite sheet: 4 frames (idle, walk1, idle, walk2)
    -- Each frame is 12x16 pixels
    self.spriteSheet = love.graphics.newCanvas(48, 16)
    self.spriteSheet:setFilter("nearest", "nearest")

    love.graphics.setCanvas(self.spriteSheet)
    love.graphics.clear(0, 0, 0, 0)

    -- Generate 4 frames
    for frame = 1, 4 do
        local offsetX = (frame - 1) * 12
        self:drawCharacterFrame(offsetX, 0, frame)
    end

    love.graphics.setCanvas()

    -- Create quads for each frame
    self.quads = {}
    for i = 1, 4 do
        self.quads[i] = love.graphics.newQuad((i-1) * 12, 0, 12, 16, 48, 16)
    end
end

function Character:drawCharacterFrame(ox, oy, frame)
    local skin = self.skinTone
    local hair = self.hairColor
    local shirt = self.shirtColor
    local pants = self.pantsColor

    -- Walking animation offsets
    local bodyBob = 0
    local leftLeg = 0
    local rightLeg = 0

    if frame == 2 then
        bodyBob = -1
        leftLeg = 1
        rightLeg = 0
    elseif frame == 4 then
        bodyBob = -1
        leftLeg = 0
        rightLeg = 1
    end

    -- Helper to set color from RGB table
    local function setCol(c, idx)
        idx = idx or 1
        love.graphics.setColor(c[idx][1]/255, c[idx][2]/255, c[idx][3]/255, 1)
    end

    local function setColDirect(c)
        love.graphics.setColor(c[1]/255, c[2]/255, c[3]/255, 1)
    end

    -- Draw based on pants style
    local isSkirt = self.pantsStyle == "skirt_short" or self.pantsStyle == "skirt_long"

    if isSkirt then
        -- Draw skirt
        setCol(pants, 1)
        love.graphics.rectangle("fill", ox + 3, oy + 12 + bodyBob, 6, 4)
        setCol(pants, 2)
        love.graphics.rectangle("fill", ox + 3, oy + 15 + bodyBob, 6, 1)
        -- Draw legs under skirt
        setCol(skin, 1)
        love.graphics.rectangle("fill", ox + 4, oy + 14 + leftLeg, 1, 2 - leftLeg)
        love.graphics.rectangle("fill", ox + 7, oy + 14 + rightLeg, 1, 2 - rightLeg)
    else
        -- Draw pants/legs
        setCol(pants, 1)
        love.graphics.rectangle("fill", ox + 4, oy + 13 + leftLeg, 2, 3 - leftLeg)
        love.graphics.rectangle("fill", ox + 6, oy + 13 + rightLeg, 2, 3 - rightLeg)
        setCol(pants, 2)
        love.graphics.rectangle("fill", ox + 4, oy + 14 + leftLeg, 1, 2 - leftLeg)
        love.graphics.rectangle("fill", ox + 6, oy + 14 + rightLeg, 1, 2 - rightLeg)
    end

    -- Draw body/shirt
    setCol(shirt, 1)
    love.graphics.rectangle("fill", ox + 3, oy + 8 + bodyBob, 6, 5)
    setCol(shirt, 2)
    love.graphics.rectangle("fill", ox + 3, oy + 8 + bodyBob, 1, 5)
    love.graphics.rectangle("fill", ox + 3, oy + 12 + bodyBob, 6, 1)

    -- Shirt pattern
    if self.shirtStyle == "stripes_h" then
        love.graphics.setColor(1, 1, 1, 0.3)
        love.graphics.rectangle("fill", ox + 3, oy + 9 + bodyBob, 6, 1)
        love.graphics.rectangle("fill", ox + 3, oy + 11 + bodyBob, 6, 1)
    elseif self.shirtStyle == "stripes_v" then
        love.graphics.setColor(1, 1, 1, 0.3)
        love.graphics.rectangle("fill", ox + 4, oy + 8 + bodyBob, 1, 5)
        love.graphics.rectangle("fill", ox + 7, oy + 8 + bodyBob, 1, 5)
    elseif self.shirtStyle == "dots" then
        love.graphics.setColor(1, 1, 1, 0.4)
        love.graphics.rectangle("fill", ox + 4, oy + 9 + bodyBob, 1, 1)
        love.graphics.rectangle("fill", ox + 6, oy + 10 + bodyBob, 1, 1)
    elseif self.shirtStyle == "collar" then
        love.graphics.setColor(1, 1, 1, 0.8)
        love.graphics.rectangle("fill", ox + 4, oy + 8 + bodyBob, 1, 1)
        love.graphics.rectangle("fill", ox + 7, oy + 8 + bodyBob, 1, 1)
    end

    -- Draw arms
    setCol(skin, 1)
    love.graphics.rectangle("fill", ox + 2, oy + 9 + bodyBob, 1, 3)
    love.graphics.rectangle("fill", ox + 9, oy + 9 + bodyBob, 1, 3)

    -- Draw head
    setCol(skin, 1)
    love.graphics.rectangle("fill", ox + 3, oy + 3 + bodyBob, 6, 5)
    setCol(skin, 2)
    love.graphics.rectangle("fill", ox + 3, oy + 3 + bodyBob, 1, 5)
    setCol(skin, 3)
    love.graphics.rectangle("fill", ox + 3, oy + 7 + bodyBob, 6, 1)

    -- Draw procedural hair
    love.graphics.setColor(hair[1][1]/255, hair[1][2]/255, hair[1][3]/255, 1)
    for y = 1, 4 do
        for x = 1, 8 do
            if self.hairStyle[y] and self.hairStyle[y][x] == 1 then
                love.graphics.rectangle("fill", ox + x + 1, oy + y - 1 + bodyBob, 1, 1)
            end
        end
    end
    -- Hair shadow
    love.graphics.setColor(hair[2][1]/255, hair[2][2]/255, hair[2][3]/255, 1)
    if self.hairStyle[4] then
        for x = 1, 8 do
            if self.hairStyle[4][x] == 1 then
                love.graphics.rectangle("fill", ox + x + 1, oy + 3 + bodyBob, 1, 1)
            end
        end
    end

    -- Draw eyes
    setColDirect(self.eyeColor)
    if self.eyeStyle == "normal" then
        love.graphics.rectangle("fill", ox + 4, oy + 5 + bodyBob, 1, 1)
        love.graphics.rectangle("fill", ox + 7, oy + 5 + bodyBob, 1, 1)
    elseif self.eyeStyle == "anime" then
        love.graphics.rectangle("fill", ox + 4, oy + 4 + bodyBob, 1, 2)
        love.graphics.rectangle("fill", ox + 7, oy + 4 + bodyBob, 1, 2)
    elseif self.eyeStyle == "cat" then
        love.graphics.rectangle("fill", ox + 4, oy + 5 + bodyBob, 2, 1)
        love.graphics.rectangle("fill", ox + 6, oy + 5 + bodyBob, 2, 1)
    elseif self.eyeStyle == "happy" then
        love.graphics.setColor(0, 0, 0, 1)
        love.graphics.rectangle("fill", ox + 4, oy + 5 + bodyBob, 1, 1)
        love.graphics.rectangle("fill", ox + 7, oy + 5 + bodyBob, 1, 1)
    elseif self.eyeStyle == "determined" then
        love.graphics.rectangle("fill", ox + 4, oy + 5 + bodyBob, 2, 1)
        love.graphics.rectangle("fill", ox + 6, oy + 5 + bodyBob, 2, 1)
    elseif self.eyeStyle == "sparkle" then
        love.graphics.rectangle("fill", ox + 4, oy + 5 + bodyBob, 1, 1)
        love.graphics.rectangle("fill", ox + 7, oy + 5 + bodyBob, 1, 1)
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.rectangle("fill", ox + 4, oy + 4 + bodyBob, 1, 1)
        love.graphics.rectangle("fill", ox + 7, oy + 4 + bodyBob, 1, 1)
    else
        -- Default
        love.graphics.rectangle("fill", ox + 4, oy + 5 + bodyBob, 1, 1)
        love.graphics.rectangle("fill", ox + 7, oy + 5 + bodyBob, 1, 1)
    end

    -- Draw accessory
    if self.accessory then
        if self.accessory == "bow" or self.accessory == "ribbon" then
            love.graphics.setColor(1, 0.3, 0.5, 1)
            love.graphics.rectangle("fill", ox + 2, oy + 1 + bodyBob, 2, 1)
            love.graphics.rectangle("fill", ox + 3, oy + 0 + bodyBob, 1, 1)
        elseif self.accessory == "headband" then
            love.graphics.setColor(0.9, 0.9, 0.3, 1)
            love.graphics.rectangle("fill", ox + 2, oy + 2 + bodyBob, 8, 1)
        elseif self.accessory == "flower" then
            love.graphics.setColor(1, 0.5, 0.5, 1)
            love.graphics.rectangle("fill", ox + 2, oy + 1 + bodyBob, 1, 1)
            love.graphics.setColor(1, 1, 0.5, 1)
            love.graphics.rectangle("fill", ox + 2, oy + 0 + bodyBob, 1, 1)
        elseif self.accessory == "star" then
            love.graphics.setColor(1, 1, 0.3, 1)
            love.graphics.rectangle("fill", ox + 2, oy + 0 + bodyBob, 1, 1)
        elseif self.accessory == "horn" then
            love.graphics.setColor(0.9, 0.8, 0.7, 1)
            love.graphics.rectangle("fill", ox + 5, oy + 0 + bodyBob, 2, 1)
            love.graphics.rectangle("fill", ox + 6, oy - 1 + bodyBob, 1, 1)
        elseif self.accessory == "cat_ears" then
            love.graphics.setColor(hair[1][1]/255, hair[1][2]/255, hair[1][3]/255, 1)
            love.graphics.rectangle("fill", ox + 2, oy + 0 + bodyBob, 1, 2)
            love.graphics.rectangle("fill", ox + 9, oy + 0 + bodyBob, 1, 2)
        elseif self.accessory == "halo" then
            love.graphics.setColor(1, 1, 0.7, 0.8)
            love.graphics.rectangle("fill", ox + 4, oy - 1 + bodyBob, 4, 1)
        end
    end
end

function Character:update(dt, isMoving)
    self.animTimer = self.animTimer + dt

    if isMoving then
        -- Walking animation: cycle through frames 1-2-1-4
        local walkSpeed = 8
        self.walkCycle = self.walkCycle + dt * walkSpeed
        local cyclePos = self.walkCycle % 4
        if cyclePos < 1 then
            self.frame = 1
        elseif cyclePos < 2 then
            self.frame = 2
        elseif cyclePos < 3 then
            self.frame = 1
        else
            self.frame = 4
        end
    else
        self.frame = 1
        self.walkCycle = 0
    end
end

function Character:draw(x, y, scale, facingLeft)
    scale = scale or 1
    local scaleX = facingLeft and -scale or scale

    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(
        self.spriteSheet,
        self.quads[self.frame],
        x,
        y,
        0,
        scaleX,
        scale,
        6, 8  -- Center origin
    )
end

function Character:drawPreview(x, y, scale)
    scale = scale or 2

    -- Idle bobbing
    local bob = math.sin(love.timer.getTime() * 2) * 1

    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(
        self.spriteSheet,
        self.quads[1],
        x,
        y + bob,
        0,
        scale,
        scale,
        6, 8
    )
end

function Character:getMainColor()
    return {
        self.shirtColor[1][1]/255,
        self.shirtColor[1][2]/255,
        self.shirtColor[1][3]/255
    }
end

-- Get a unique identifier string for this character
function Character:getIdentifier()
    return string.format("%d", self.seed)
end

return Character
