-- Pixel-perfect rendering system
-- Renders to a small canvas then scales up for crisp pixels

local PixelCanvas = {}
PixelCanvas.__index = PixelCanvas

-- Base resolution (portrait for mobile-first)
PixelCanvas.BASE_WIDTH = 180
PixelCanvas.BASE_HEIGHT = 320

function PixelCanvas.new()
    local self = setmetatable({}, PixelCanvas)

    -- Wrap canvas creation in pcall for Love.js compatibility
    local success, err = pcall(function()
        self.canvas = love.graphics.newCanvas(
            PixelCanvas.BASE_WIDTH,
            PixelCanvas.BASE_HEIGHT
        )
        self.canvas:setFilter("nearest", "nearest")
    end)

    if not success then
        print("[PixelCanvas] Canvas creation failed:", err)
        self.canvas = nil
    end

    self.scale = 1
    self.offsetX = 0
    self.offsetY = 0

    self:resize(love.graphics.getDimensions())

    return self
end

function PixelCanvas:resize(windowWidth, windowHeight)
    -- Calculate scale to fit window while maintaining aspect ratio
    local scaleX = windowWidth / PixelCanvas.BASE_WIDTH
    local scaleY = windowHeight / PixelCanvas.BASE_HEIGHT

    -- Use the smaller scale to fit entirely, or larger for fill
    self.scale = math.floor(math.min(scaleX, scaleY))
    if self.scale < 1 then self.scale = 1 end

    -- Center the canvas
    local scaledWidth = PixelCanvas.BASE_WIDTH * self.scale
    local scaledHeight = PixelCanvas.BASE_HEIGHT * self.scale
    self.offsetX = math.floor((windowWidth - scaledWidth) / 2)
    self.offsetY = math.floor((windowHeight - scaledHeight) / 2)
end

function PixelCanvas:startDraw()
    if self.canvas then
        love.graphics.setCanvas(self.canvas)
        love.graphics.clear(0.08, 0.08, 0.12, 1)
    else
        -- Fallback: draw directly to screen
        love.graphics.clear(0.08, 0.08, 0.12, 1)
    end
end

function PixelCanvas:endDraw(shader, time)
    if self.canvas then
        love.graphics.setCanvas()

        -- Draw black bars
        love.graphics.setColor(0, 0, 0, 1)
        love.graphics.rectangle("fill", 0, 0, love.graphics.getWidth(), love.graphics.getHeight())

        -- Apply shader if provided
        if shader then
            love.graphics.setShader(shader)
            if shader:hasUniform("time") then
                shader:send("time", time or 0)
            end
            if shader:hasUniform("inputSize") then
                shader:send("inputSize", {PixelCanvas.BASE_WIDTH * self.scale, PixelCanvas.BASE_HEIGHT * self.scale})
            end
        end

        -- Draw scaled canvas
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.draw(
            self.canvas,
            self.offsetX,
            self.offsetY,
            0,
            self.scale,
            self.scale
        )

        -- Reset shader
        love.graphics.setShader()
    end
    -- If no canvas, content was drawn directly to screen in startDraw()
end

-- Convert screen coordinates to game coordinates
function PixelCanvas:toGame(screenX, screenY)
    local gameX = (screenX - self.offsetX) / self.scale
    local gameY = (screenY - self.offsetY) / self.scale
    return gameX, gameY
end

-- Convert game coordinates to screen coordinates
function PixelCanvas:toScreen(gameX, gameY)
    local screenX = gameX * self.scale + self.offsetX
    local screenY = gameY * self.scale + self.offsetY
    return screenX, screenY
end

function PixelCanvas:getWidth()
    return PixelCanvas.BASE_WIDTH
end

function PixelCanvas:getHeight()
    return PixelCanvas.BASE_HEIGHT
end

return PixelCanvas
