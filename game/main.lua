-- MINIMAL TEST - No requires, no complexity
-- Testing if Love.js game loop works at all
print("[MINIMAL] Starting...")

function love.load()
    print("[MINIMAL] love.load called")
end

function love.update(dt)
    print("[MINIMAL] love.update called")
end

function love.draw()
    print("[MINIMAL] love.draw called")
    love.graphics.clear(1, 0, 0)  -- Red screen
    love.graphics.setColor(1, 1, 1)
    love.graphics.print("Hello World!", 100, 100)
end
