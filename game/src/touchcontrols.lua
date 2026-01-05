-- Mobile Touch Controls
-- Virtual joystick - appears at touch location, works anywhere on screen

local TouchControls = {}
TouchControls.__index = TouchControls

function TouchControls.new(pixelCanvas)
    local self = setmetatable({}, TouchControls)

    self.pixelCanvas = pixelCanvas

    -- Joystick state (positioned for portrait bottom-left)
    self.joystick = {
        active = false,
        touchId = nil,
        baseX = 40,
        baseY = 280,
        stickX = 40,
        stickY = 280,
        radius = 25,
        stickRadius = 10,
        dx = 0,
        dy = 0,
    }

    -- Shoot button / right side touch
    self.shoot = {
        active = false,
        touchId = nil,
        targetX = 0,
        targetY = 0,
    }

    -- Visual feedback state
    self.feedback = {
        joystickPulse = 0,  -- Pulse animation timer (0-1)
        shootPulse = 0,
    }

    -- Detect if we're on mobile
    self.isMobile = love.system.getOS() == "iOS" or
                    love.system.getOS() == "Android" or
                    love.system.getOS() == "Web"

    return self
end

function TouchControls:touchpressed(id, x, y)
    -- Convert to game coordinates
    local gx, gy = self.pixelCanvas:toGame(x, y)

    -- Any touch becomes joystick - appears at touch location
    if not self.joystick.active then
        self.joystick.active = true
        self.joystick.touchId = id
        self.joystick.baseX = gx
        self.joystick.baseY = gy
        self.joystick.stickX = gx
        self.joystick.stickY = gy
        self.feedback.joystickPulse = 1
    end
end

function TouchControls:touchmoved(id, x, y)
    local gx, gy = self.pixelCanvas:toGame(x, y)

    if id == self.joystick.touchId then
        -- Calculate joystick offset
        local dx = gx - self.joystick.baseX
        local dy = gy - self.joystick.baseY
        local dist = math.sqrt(dx * dx + dy * dy)

        -- Clamp to joystick radius
        if dist > self.joystick.radius then
            dx = dx / dist * self.joystick.radius
            dy = dy / dist * self.joystick.radius
        end

        self.joystick.stickX = self.joystick.baseX + dx
        self.joystick.stickY = self.joystick.baseY + dy

        -- Normalize for movement (-1 to 1)
        self.joystick.dx = dx / self.joystick.radius
        self.joystick.dy = dy / self.joystick.radius

    elseif id == self.shoot.touchId then
        self.shoot.targetX = gx
        self.shoot.targetY = gy
    end
end

function TouchControls:touchreleased(id, x, y)
    if id == self.joystick.touchId then
        self.joystick.active = false
        self.joystick.touchId = nil
        self.joystick.dx = 0
        self.joystick.dy = 0
    end

    if id == self.shoot.touchId then
        self.shoot.active = false
        self.shoot.touchId = nil
    end
end

function TouchControls:update(dt)
    -- Safety reset: check if joystick touch is still active
    -- This handles cases where touchreleased wasn't called properly (Love.js/browser issues)
    if self.joystick.active and self.joystick.touchId then
        local touches = love.touch.getTouches()
        local touchStillActive = false
        for _, id in ipairs(touches) do
            if id == self.joystick.touchId then
                touchStillActive = true
                break
            end
        end
        if not touchStillActive then
            self.joystick.active = false
            self.joystick.touchId = nil
            self.joystick.dx = 0
            self.joystick.dy = 0
        end
    end

    -- Decay pulse animations
    if self.feedback.joystickPulse > 0 then
        self.feedback.joystickPulse = math.max(0, self.feedback.joystickPulse - dt * 4)
    end
    if self.feedback.shootPulse > 0 then
        self.feedback.shootPulse = math.max(0, self.feedback.shootPulse - dt * 4)
    end
end

function TouchControls:getMovement()
    -- Return joystick movement or keyboard input
    local dx, dy = 0, 0

    if self.joystick.active then
        dx = self.joystick.dx
        dy = self.joystick.dy
    else
        -- Keyboard fallback
        if love.keyboard.isDown("w", "up") then dy = -1 end
        if love.keyboard.isDown("s", "down") then dy = 1 end
        if love.keyboard.isDown("a", "left") then dx = -1 end
        if love.keyboard.isDown("d", "right") then dx = 1 end

        -- Normalize diagonal
        if dx ~= 0 and dy ~= 0 then
            dx = dx * 0.707
            dy = dy * 0.707
        end
    end

    return dx, dy
end

function TouchControls:getAimTarget(playerX, playerY)
    if self.shoot.active then
        return self.shoot.targetX, self.shoot.targetY
    else
        -- Mouse fallback
        local mx, my = love.mouse.getPosition()
        return self.pixelCanvas:toGame(mx, my)
    end
end

function TouchControls:isShooting()
    return self.shoot.active or love.mouse.isDown(1)
end

function TouchControls:draw()
    -- Only draw when actively touching
    if not self.joystick.active then return end

    local alpha = 0.6

    -- Pulse effect on activation
    local pulseScale = 1 + self.feedback.joystickPulse * 0.3
    local pulseAlpha = self.feedback.joystickPulse * 0.5

    -- Draw pulse ring on joystick activation
    if pulseAlpha > 0 then
        love.graphics.setColor(0, 1, 1, pulseAlpha)
        love.graphics.circle("line", self.joystick.baseX, self.joystick.baseY,
            self.joystick.radius * pulseScale)
    end

    -- Draw joystick base
    love.graphics.setColor(1, 1, 1, alpha * 0.3)
    love.graphics.circle("fill", self.joystick.baseX, self.joystick.baseY, self.joystick.radius)
    love.graphics.setColor(1, 1, 1, alpha * 0.5)
    love.graphics.circle("line", self.joystick.baseX, self.joystick.baseY, self.joystick.radius)

    -- Draw direction indicator line when moving
    if self.joystick.active and (math.abs(self.joystick.dx) > 0.1 or math.abs(self.joystick.dy) > 0.1) then
        local lineLength = 40
        local endX = self.joystick.baseX + self.joystick.dx * lineLength
        local endY = self.joystick.baseY + self.joystick.dy * lineLength
        love.graphics.setColor(0, 1, 1, 0.4)
        love.graphics.setLineWidth(2)
        love.graphics.line(self.joystick.baseX, self.joystick.baseY, endX, endY)
        love.graphics.setLineWidth(1)
    end

    -- Draw joystick stick
    love.graphics.setColor(1, 1, 1, 0.9)
    love.graphics.circle("fill", self.joystick.stickX, self.joystick.stickY, self.joystick.stickRadius)
end

return TouchControls
