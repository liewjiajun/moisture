-- Particle system for fluid/moisture effects
local Particles = {}
Particles.__index = Particles

function Particles.new()
    local self = setmetatable({}, Particles)
    self.particles = {}
    self.maxParticles = 500
    return self
end

function Particles:emit(x, y, count, config)
    config = config or {}
    for i = 1, count do
        if #self.particles >= self.maxParticles then
            table.remove(self.particles, 1)
        end

        local angle = config.angle or (love.math.random() * math.pi * 2)
        local speed = config.speed or (love.math.random() * 50 + 20)
        local life = config.life or (love.math.random() * 0.5 + 0.3)

        table.insert(self.particles, {
            x = x + (love.math.random() - 0.5) * (config.spread or 10),
            y = y + (love.math.random() - 0.5) * (config.spread or 10),
            vx = math.cos(angle) * speed,
            vy = math.sin(angle) * speed,
            life = life,
            maxLife = life,
            size = config.size or (love.math.random() * 4 + 2),
            color = config.color or {0, 1, 1, 1},
            gravity = config.gravity or 50,
            drag = config.drag or 0.98
        })
    end
end

function Particles:emitTrail(x, y, color)
    self:emit(x, y, 1, {
        speed = love.math.random() * 20 + 5,
        life = 0.3 + love.math.random() * 0.2,
        size = love.math.random() * 3 + 1,
        color = color or {0, 1, 1, 0.5},
        gravity = 20,
        spread = 5
    })
end

function Particles:emitDeath(x, y)
    for i = 1, 30 do
        local angle = (i / 30) * math.pi * 2
        self:emit(x, y, 1, {
            angle = angle,
            speed = love.math.random() * 150 + 100,
            life = 1 + love.math.random() * 0.5,
            size = love.math.random() * 8 + 4,
            color = {0, 1, love.math.random(), 1},
            gravity = 0,
            spread = 0
        })
    end
end

function Particles:emitDrip(x, y, color)
    self:emit(x, y, 3, {
        angle = math.pi / 2 + (love.math.random() - 0.5) * 0.5,
        speed = love.math.random() * 30 + 20,
        life = 0.8 + love.math.random() * 0.4,
        size = love.math.random() * 5 + 3,
        color = color or {0, 1, 0.5, 0.8},
        gravity = 150,
        spread = 3
    })
end

function Particles:update(dt)
    for i = #self.particles, 1, -1 do
        local p = self.particles[i]
        p.life = p.life - dt

        if p.life <= 0 then
            table.remove(self.particles, i)
        else
            p.vy = p.vy + p.gravity * dt
            p.vx = p.vx * p.drag
            p.vy = p.vy * p.drag
            p.x = p.x + p.vx * dt
            p.y = p.y + p.vy * dt
        end
    end
end

function Particles:draw()
    for _, p in ipairs(self.particles) do
        local colorAlpha = p.color[4] or 1
        local alpha = (p.life / p.maxLife) * colorAlpha
        love.graphics.setColor(p.color[1], p.color[2], p.color[3], alpha)

        -- Draw dripping blob shape
        local size = p.size * (0.5 + 0.5 * (p.life / p.maxLife))
        love.graphics.circle("fill", p.x, p.y, size)

        -- Draw stretched tail
        if math.abs(p.vy) > 10 then
            local stretch = math.min(size * 2, math.abs(p.vy) * 0.05)
            love.graphics.ellipse("fill", p.x, p.y - stretch * 0.5, size * 0.7, stretch)
        end
    end
end

function Particles:clear()
    self.particles = {}
end

return Particles
