-- MOISTURE: The Viscous High-Stakes Survivor
-- Touhou-Style Bullet Hell with Bouncing Bullets

local PixelCanvas = require("src.pixelcanvas")
local Character = require("src.character")
local TouchControls = require("src.touchcontrols")
local Enemies = require("src.enemies")
local Bridge = require("src.bridge")
local Cards = require("src.cards")
local Upgrades = require("src.upgrades")
local Sauna = require("src.sauna")
local Sounds = require("src.sounds")

-- Game states
local STATE = {
    MENU = "menu",
    LOUNGE = "lounge",
    COUNTDOWN = "countdown",
    GAME = "game",
    CARD_SELECT = "card_select",
    DEATH = "death"
}

-- Game variables
local state = STATE.MENU
local isGuest = false
local isPracticeGame = false
local countdownTimer = 0
local pixelCanvas
local touchControls
local cards
local upgrades
local gameTime = 0
local survivalTime = 0
local humidity = 1
local score = 0

-- Card selection timing
local cardTimer = 0
local CARD_INTERVAL = 10  -- Seconds between card selections

-- Player
local player = nil
local playerCharacter = nil

-- Entities
local enemies = {}
local bullets = {}
local particles = {}

-- Screen shake
local shake = {x = 0, y = 0, intensity = 0}

-- Fonts (pixel-style)
local fonts = {}

-- CRT shader
local crtShader = nil
local crtEnabled = true

-- Sauna lounge
local sauna = nil

function love.load()
    -- Pixel-perfect rendering (setLineStyle removed - not supported in WebGL)
    love.graphics.setDefaultFilter("nearest", "nearest")

    -- Initialize systems
    pixelCanvas = PixelCanvas.new()
    touchControls = TouchControls.new(pixelCanvas)
    cards = Cards.new()
    upgrades = Upgrades.new()
    Bridge.init()
    Sounds.load()

    -- Create pixel fonts with fallback for Love.js
    local fontSuccess = pcall(function()
        fonts.small = love.graphics.newFont(8)
        fonts.medium = love.graphics.newFont(12)
        fonts.large = love.graphics.newFont(16)
    end)
    if not fontSuccess then
        local defaultFont = love.graphics.getFont()
        fonts.small = defaultFont
        fonts.medium = defaultFont
        fonts.large = defaultFont
        print("[Fonts] Using default font as fallback")
    end

    -- Load CRT shader
    local success, shader = pcall(function()
        return love.graphics.newShader("shaders/crt.glsl")
    end)
    if success then
        crtShader = shader
    else
        print("CRT shader failed to load:", shader)
    end

    -- Set up touch handlers
    love.handlers.startgame = function()
        startGame()
    end

    -- Initialize sauna with fallback for Love.js
    local saunaSuccess, saunaResult = pcall(function()
        return Sauna.new(pixelCanvas:getWidth(), pixelCanvas:getHeight())
    end)
    if saunaSuccess then
        sauna = saunaResult
    else
        print("[Sauna] Failed to create:", saunaResult)
        sauna = {
            update = function() end,
            draw = function() end,
            touchpressed = function() end,
            touchmoved = function() end,
            touchreleased = function() end,
            keypressed = function() end,
            textinput = function() end,
        }
    end
end

function love.resize(w, h)
    pixelCanvas:resize(w, h)
end

function love.update(dt)
    gameTime = gameTime + dt

    -- Update shake
    if shake.intensity > 0 then
        shake.x = (love.math.random() - 0.5) * shake.intensity
        shake.y = (love.math.random() - 0.5) * shake.intensity
        shake.intensity = shake.intensity * 0.9
        if shake.intensity <= 0.3 then shake.intensity = 0 end
    end

    -- Update touch controls (for visual feedback animations)
    touchControls:update(dt)

    if state == STATE.MENU then
        updateMenu(dt)
    elseif state == STATE.LOUNGE then
        updateLounge(dt)
    elseif state == STATE.COUNTDOWN then
        updateCountdown(dt)
    elseif state == STATE.GAME then
        updateGame(dt)
    elseif state == STATE.CARD_SELECT then
        cards:update(dt)
    elseif state == STATE.DEATH then
        updateDeath(dt)
    end

    -- Update particles
    updateParticles(dt)
end

function updateMenu(dt)
    -- Auto-transition to LOUNGE when wallet connects
    if Bridge.walletConnected then
        isGuest = false
        state = STATE.LOUNGE
        return
    end

    -- Update sauna in background (for visual activity)
    if sauna then
        sauna:update(dt)
    end

    -- Generate character preview if needed
    if not playerCharacter then
        local seed = Bridge.characterSeed
        if not seed then
            seed = os.time() + love.math.random(1, 999999)
            Bridge.characterSeed = seed
        end
        playerCharacter = Character.new(seed)
    end
    playerCharacter:update(dt, false)
end

function updateLounge(dt)
    -- Generate character preview from seed
    if not playerCharacter then
        local seed = Bridge.characterSeed
        if not seed then
            seed = os.time() + love.math.random(1, 999999)
            Bridge.characterSeed = seed
        end
        playerCharacter = Character.new(seed)
    end
    playerCharacter:update(dt, sauna and sauna.playerIsMoving or false)

    -- Update sauna with touch controls for player movement
    if sauna then
        sauna:update(dt, touchControls)
    end
end

-- Track which countdown sounds have played
local countdownSoundsPlayed = { three = false, two = false, one = false, go = false }

function updateCountdown(dt)
    countdownTimer = countdownTimer - dt

    -- Play countdown sounds at appropriate times
    if countdownTimer <= 3.0 and countdownTimer > 2.0 and not countdownSoundsPlayed.three then
        Sounds.play("countdown", 0.7, 1.0)
        countdownSoundsPlayed.three = true
    elseif countdownTimer <= 2.0 and countdownTimer > 1.0 and not countdownSoundsPlayed.two then
        Sounds.play("countdown", 0.7, 1.1)
        countdownSoundsPlayed.two = true
    elseif countdownTimer <= 1.0 and countdownTimer > 0.0 and not countdownSoundsPlayed.one then
        Sounds.play("countdown", 0.7, 1.2)
        countdownSoundsPlayed.one = true
    elseif countdownTimer <= 0.0 and not countdownSoundsPlayed.go then
        Sounds.play("go", 0.9, 1.0)
        countdownSoundsPlayed.go = true
    end

    if countdownTimer <= 0 then
        state = STATE.GAME
        -- Spawn initial enemies when countdown ends
        for i = 1, 2 do
            spawnEnemy()
        end
    end
end

function updateGame(dt)
    survivalTime = survivalTime + dt
    cardTimer = cardTimer + dt

    -- Check for card selection time
    if cardTimer >= CARD_INTERVAL then
        cardTimer = 0
        if cards:showSelection() then
            state = STATE.CARD_SELECT
            return
        end
    end

    -- Increase difficulty
    humidity = 1 + math.floor(survivalTime / 10) * 0.2

    -- Update player
    if player then
        updatePlayer(dt)
    end

    -- Update enemies
    updateEnemies(dt)

    -- Update bullets (with bouncing!)
    updateBullets(dt)


    -- Update upgrade effects
    local isMoving = player.lastDx ~= 0 or player.lastDy ~= 0
    local moveSpeed = math.sqrt(player.lastDx^2 + player.lastDy^2)
    upgrades:update(dt, player.x, player.y, isMoving, moveSpeed, cards.levels)

    -- Spawn enemies (reduced rate, fewer but more dangerous)
    local spawnRate = 0.004 + humidity * 0.002  -- Much slower spawn rate
    if love.math.random() < spawnRate then
        spawnEnemy()
    end

    -- Check collisions
    checkCollisions()
end

function updateDeath(dt)
    -- Just particles
end

function updatePlayer(dt)
    -- Get input
    local dx, dy = touchControls:getMovement()
    local baseSpeed = 55

    -- Apply speed upgrade
    local speedMult = upgrades:getSpeedMultiplier(cards.levels)
    local speed = baseSpeed * speedMult

    -- Move
    player.x = player.x + dx * speed * dt
    player.y = player.y + dy * speed * dt

    -- Clamp to screen
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()
    player.x = math.max(8, math.min(w - 8, player.x))
    player.y = math.max(8, math.min(h - 8, player.y))

    -- Update character animation
    local isMoving = dx ~= 0 or dy ~= 0
    playerCharacter:update(dt, isMoving)

    -- Facing direction based on movement
    if dx ~= 0 then
        player.facingLeft = dx < 0
    end

    -- Store movement direction for blink
    player.lastDx = dx
    player.lastDy = dy

    -- Calculate and store visual scale (for TINY upgrade)
    -- Always use false for isMovingSlow to ensure TINY applies consistently during movement
    player.visualScale = upgrades:getHitboxMultiplier(cards.levels, false)
end

function updateEnemies(dt)
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()
    local fireRateMult = upgrades:getEnemyFireRateMultiplier(cards.levels)
    local chaosSpread = upgrades:getChaosSpread(cards.levels)

    for i = #enemies, 1, -1 do
        local e = enemies[i]

        if not e.alive then
            table.remove(enemies, i)
        else
            -- Move randomly in top quarter of screen
            local topQuarter = h * 0.25

            -- Random movement direction (change occasionally)
            e.moveTimer = (e.moveTimer or 0) + dt
            if e.moveTimer > 2 or not e.moveDx then
                e.moveTimer = 0
                e.moveDx = (love.math.random() - 0.5) * 2
                e.moveDy = (love.math.random() - 0.5) * 2
            end

            -- Move randomly
            local speed = e.speed * 0.3 * (1 + (humidity - 1) * 0.1)
            e.x = e.x + e.moveDx * speed * dt
            e.y = e.y + e.moveDy * speed * dt

            -- Keep in bounds (top quarter)
            if e.x < 10 then e.x = 10; e.moveDx = math.abs(e.moveDx) end
            if e.x > w - 10 then e.x = w - 10; e.moveDx = -math.abs(e.moveDx) end
            if e.y < 10 then e.y = 10; e.moveDy = math.abs(e.moveDy) end
            if e.y > topQuarter then e.y = topQuarter; e.moveDy = -math.abs(e.moveDy) end

            e.facingLeft = e.moveDx < 0

            -- Animation
            e.animTime = (e.animTime or 0) + dt
            e.bobOffset = math.sin(e.animTime * 6) * 1

            -- ALL enemies shoot with dynamic patterns!
            e.shootCooldown = (e.shootCooldown or e.shootRate) - dt
            if e.shootCooldown <= 0 and player then
                -- Apply calm upgrade (slower fire)
                e.shootCooldown = (e.shootRate / humidity) * fireRateMult

                -- Get bullet pattern based on enemy type
                local pattern = e.bulletPattern or "single"
                local bulletSpeed = 35 + humidity * 3
                local bulletRadius = 3

                -- Calculate base aim toward player
                local baseDx = player.x - e.x
                local baseDy = player.y - e.y
                local dist = math.sqrt(baseDx * baseDx + baseDy * baseDy)
                if dist > 0 then
                    baseDx, baseDy = baseDx / dist, baseDy / dist
                end
                local baseAngle = math.atan2(baseDy, baseDx)

                -- Apply chaos upgrade
                if chaosSpread > 0 then
                    baseAngle = baseAngle + (love.math.random() - 0.5) * chaosSpread * 2
                end

                -- Spawn bullets based on pattern
                local bulletsToSpawn = {}

                if pattern == "spread3" then
                    -- 3-way spread
                    for i = -1, 1 do
                        local angle = baseAngle + i * 0.3
                        table.insert(bulletsToSpawn, {angle = angle, speed = bulletSpeed})
                    end
                elseif pattern == "spread5" then
                    -- 5-way spread
                    for i = -2, 2 do
                        local angle = baseAngle + i * 0.25
                        table.insert(bulletsToSpawn, {angle = angle, speed = bulletSpeed * 0.9})
                    end
                elseif pattern == "ring" then
                    -- Ring of bullets
                    local numBullets = 8 + math.floor(humidity)
                    for i = 1, numBullets do
                        local angle = (i / numBullets) * math.pi * 2
                        table.insert(bulletsToSpawn, {angle = angle, speed = bulletSpeed * 0.7})
                    end
                elseif pattern == "spiral" then
                    -- Spiral pattern (uses enemy's animation timer for rotation)
                    e.spiralOffset = (e.spiralOffset or 0) + 0.5
                    local numBullets = 3
                    for i = 1, numBullets do
                        local angle = e.spiralOffset + (i / numBullets) * math.pi * 2
                        table.insert(bulletsToSpawn, {angle = angle, speed = bulletSpeed * 0.8})
                    end
                elseif pattern == "burst" then
                    -- Aimed burst of 3 bullets with slight delay simulation
                    for i = 0, 2 do
                        local speedMod = 1 - i * 0.1
                        table.insert(bulletsToSpawn, {angle = baseAngle, speed = bulletSpeed * speedMod})
                    end
                elseif pattern == "wave" then
                    -- Wavy pattern
                    local waveOffset = math.sin(e.animTime * 3) * 0.5
                    table.insert(bulletsToSpawn, {angle = baseAngle + waveOffset, speed = bulletSpeed})
                    table.insert(bulletsToSpawn, {angle = baseAngle - waveOffset, speed = bulletSpeed})
                elseif pattern == "random_spread" then
                    -- Random spread of 2-4 bullets
                    local numBullets = love.math.random(2, 4)
                    for i = 1, numBullets do
                        local angle = baseAngle + (love.math.random() - 0.5) * 1.2
                        table.insert(bulletsToSpawn, {angle = angle, speed = bulletSpeed * (0.8 + love.math.random() * 0.4)})
                    end
                elseif pattern == "aimed_double" then
                    -- Two aimed shots with slight spread
                    table.insert(bulletsToSpawn, {angle = baseAngle - 0.15, speed = bulletSpeed})
                    table.insert(bulletsToSpawn, {angle = baseAngle + 0.15, speed = bulletSpeed})
                else
                    -- Single shot (default)
                    table.insert(bulletsToSpawn, {angle = baseAngle, speed = bulletSpeed})
                end

                -- Create the bullets
                for _, bulletData in ipairs(bulletsToSpawn) do
                    local dx = math.cos(bulletData.angle)
                    local dy = math.sin(bulletData.angle)
                    table.insert(bullets, {
                        x = e.x,
                        y = e.y,
                        vx = dx * bulletData.speed,
                        vy = dy * bulletData.speed,
                        baseSpeed = bulletData.speed,
                        life = 10,
                        bounces = 0,
                        maxBounces = 2,
                        radius = bulletRadius,
                        damage = 1,
                        fromEnemy = e,
                    })
                end

                -- Play shoot sound (with variation)
                if #bulletsToSpawn > 0 then
                    Sounds.playVaried("shoot", 0.2, 0.3)
                end
            end

            -- Remove if far off screen
            if e.x < -30 or e.x > w + 30 or e.y < -30 or e.y > h + 30 then
                table.remove(enemies, i)
            end
        end
    end
end

function updateBullets(dt)
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()

    -- Get upgrade effects
    local repelStrength = upgrades:getRepelStrength(cards.levels)
    local freezeRange = upgrades:getFreezeRange(cards.levels)
    local freezeStrength = upgrades:getFreezeStrength(cards.levels)
    local shrinkRange = upgrades:getShrinkRange(cards.levels)
    local shrinkAmount = upgrades:getShrinkAmount(cards.levels)

    for i = #bullets, 1, -1 do
        local b = bullets[i]

        -- Apply repel (curve away from player)
        if repelStrength > 0 and player then
            local dx = b.x - player.x
            local dy = b.y - player.y
            local dist = math.sqrt(dx * dx + dy * dy)
            local repelRange = 30 + cards.levels.repel * 5

            if dist < repelRange and dist > 0 then
                local force = repelStrength * (1 - dist / repelRange) * dt
                b.vx = b.vx + (dx / dist) * force
                b.vy = b.vy + (dy / dist) * force

                -- Normalize speed
                local speed = math.sqrt(b.vx^2 + b.vy^2)
                if speed > b.baseSpeed * 1.5 then
                    b.vx = b.vx / speed * b.baseSpeed
                    b.vy = b.vy / speed * b.baseSpeed
                end
            end
        end

        -- Apply freeze (slow down near player)
        local speedMult = 1
        if freezeRange > 0 and player then
            local dx = b.x - player.x
            local dy = b.y - player.y
            local dist = math.sqrt(dx * dx + dy * dy)

            if dist < freezeRange then
                speedMult = 1 - freezeStrength * (1 - dist / freezeRange)
            end
        end

        -- Apply shrink (make bullet smaller near player)
        local radiusMult = 1
        if shrinkRange > 0 and player then
            local dx = b.x - player.x
            local dy = b.y - player.y
            local dist = math.sqrt(dx * dx + dy * dy)

            if dist < shrinkRange then
                radiusMult = 1 - shrinkAmount * (1 - dist / shrinkRange)
            end
        end
        b.currentRadius = b.radius * math.max(0.3, radiusMult)

        -- Move bullet
        b.x = b.x + b.vx * speedMult * dt
        b.y = b.y + b.vy * speedMult * dt
        b.life = b.life - dt

        -- Bullet trail particles (polish effect)
        b.trailTimer = (b.trailTimer or 0) + dt
        if b.trailTimer > 0.05 then
            b.trailTimer = 0
            local trailColor
            if b.bounces == 0 then
                trailColor = {1, 0.3, 0.3, 0.4}
            elseif b.bounces == 1 then
                trailColor = {1, 0.8, 0.3, 0.4}
            else
                trailColor = {0.3, 1, 0.5, 0.4}
            end
            spawnParticle(b.x, b.y, 0, 0, trailColor, 0.15)
        end

        -- BOUNCE off walls!
        local bounced = false
        if b.x < 4 then
            b.x = 4
            b.vx = -b.vx
            bounced = true
        elseif b.x > w - 4 then
            b.x = w - 4
            b.vx = -b.vx
            bounced = true
        end

        if b.y < 4 then
            b.y = 4
            b.vy = -b.vy
            bounced = true
        elseif b.y > h - 4 then
            b.y = h - 4
            b.vy = -b.vy
            bounced = true
        end

        if bounced then
            b.bounces = b.bounces + 1
            -- Bounce particles (enhanced)
            for p = 1, 4 do
                local angle = love.math.random() * math.pi * 2
                local speed = 20 + love.math.random() * 20
                spawnParticle(b.x, b.y, math.cos(angle) * speed, math.sin(angle) * speed, {1, 0.9, 0.4, 1}, 0.3)
            end
            -- Screen shake on bounce
            shake.intensity = math.min(shake.intensity + 0.5, 3)
            -- Bounce sound
            Sounds.playVaried("bounce", 0.4, 0.2)
        end

        -- Check if bounced bullet hits enemies
        if b.bounces > 0 then
            for _, e in ipairs(enemies) do
                if e.alive and e ~= b.fromEnemy then
                    local dx = e.x - b.x
                    local dy = e.y - b.y
                    local dist = math.sqrt(dx * dx + dy * dy)

                    if dist < 6 + b.currentRadius then
                        -- Hit enemy!
                        local dmgMult = upgrades:getBulletDamageMultiplier(cards.levels, true)
                        local damage = math.ceil(b.damage * dmgMult * b.bounces)
                        damageEnemy(e, damage)

                        -- Remove bullet
                        b.life = 0
                        break
                    end
                end
            end
        end

        -- Remove if expired or too many bounces
        if b.life <= 0 or b.bounces > b.maxBounces then
            table.remove(bullets, i)
        end
    end
end


function updateParticles(dt)
    for i = #particles, 1, -1 do
        local p = particles[i]
        p.life = p.life - dt
        p.x = p.x + p.vx * dt
        p.y = p.y + p.vy * dt
        p.vy = p.vy + 30 * dt  -- Gravity

        if p.life <= 0 then
            table.remove(particles, i)
        end
    end
end

function spawnParticle(x, y, vx, vy, color, life)
    table.insert(particles, {
        x = x,
        y = y,
        vx = vx or 0,
        vy = vy or 0,
        color = color or {1, 1, 1, 1},
        life = life or 0.5,
        maxLife = life or 0.5,
    })
end

function spawnEnemy()
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()
    local topQuarter = h * 0.25  -- Enemies only in top quarter

    -- Spawn from top edges only
    local edge = love.math.random(1, 3)
    local x, y
    if edge == 1 then
        x, y = love.math.random(0, w), -10  -- Top
    elseif edge == 2 then
        x, y = w + 10, love.math.random(0, topQuarter)  -- Right (top quarter)
    else
        x, y = -10, love.math.random(0, topQuarter)  -- Left (top quarter)
    end

    local enemyType = Enemies.getRandomType(humidity)
    local stats = Enemies.getStats(enemyType)

    -- Bullet patterns based on enemy type
    local bulletPatterns = {
        fairy = "spread3",       -- 3-way spread
        slime = "random_spread", -- Random spray
        bunny = "burst",         -- Fast burst
        neko = "wave",           -- Wavy pattern
        witch = "spread5",       -- 5-way spread
        miko = "aimed_double",   -- Double aimed shots
        ghost = "spiral",        -- Spiral pattern
        demon = "ring",          -- Ring of bullets
        kitsune = "spread5",     -- 5-way spread (multishot)
        angel = "ring",          -- Ring pattern
    }

    -- Shoot rates - slower but more bullets per shot
    local shootRates = {
        fairy = 2.0,
        slime = 2.5,
        bunny = 1.5,
        neko = 1.8,
        witch = 2.2,
        miko = 1.6,
        ghost = 1.4,
        demon = 2.8,
        kitsune = 1.2,
        angel = 2.0,
    }

    local shootRate = (shootRates[enemyType] or 2.0) * (1.5 / humidity)
    local bulletPattern = bulletPatterns[enemyType] or "single"

    table.insert(enemies, {
        x = x,
        y = y,
        type = enemyType,
        sprite = Enemies.generateSprite(enemyType),
        speed = stats.speed,
        health = stats.health,
        maxHealth = stats.health,
        shootRate = shootRate,
        shootCooldown = love.math.random() * shootRate,
        bulletPattern = bulletPattern,
        points = stats.points,
        splits = stats.splits,
        facingLeft = false,
        animTime = love.math.random() * 10,
        bobOffset = 0,
        alive = true,
        hitFlash = 0,
        spawnEffect = 0.5,
    })

    -- Spawn particles (portal effect)
    for p = 1, 6 do
        local angle = (p / 6) * math.pi * 2
        spawnParticle(x, y, math.cos(angle) * 25, math.sin(angle) * 25, {0.6, 0.3, 0.9, 0.8}, 0.4)
    end
end

function damageEnemy(enemy, damage)
    if not enemy.alive then return end

    enemy.health = enemy.health - damage
    enemy.hitFlash = 0.15

    -- Hit particles
    for p = 1, 3 do
        local angle = love.math.random() * math.pi * 2
        spawnParticle(enemy.x, enemy.y, math.cos(angle) * 40, math.sin(angle) * 40, {1, 0.8, 0.3, 1}, 0.3)
    end

    shake.intensity = math.min(shake.intensity + 1, 4)

    if enemy.health <= 0 then
        killEnemy(enemy)
    end
end

function killEnemy(enemy)
    enemy.alive = false

    -- Haptic feedback on enemy kill (medium vibration)
    Bridge.triggerHaptic("medium")

    -- Score
    score = score + enemy.points

    -- Death particles
    for p = 1, 8 do
        local angle = (p / 8) * math.pi * 2
        local color = playerCharacter:getMainColor()
        spawnParticle(enemy.x, enemy.y, math.cos(angle) * 50, math.sin(angle) * 50, {color[1], color[2], color[3], 1}, 0.5)
    end

    -- Split if spore type
    if enemy.splits then
        for s = 1, 2 do
            local stats = Enemies.getStats("slime")
            table.insert(enemies, {
                x = enemy.x + (s == 1 and -8 or 8),
                y = enemy.y,
                type = "slime",
                sprite = Enemies.generateSprite("slime"),
                speed = stats.speed * 1.5,
                health = 1,
                maxHealth = 1,
                shootRate = 3,
                shootCooldown = 1,
                points = 5,
                facingLeft = false,
                animTime = 0,
                bobOffset = 0,
                alive = true,
                hitFlash = 0,
            })
        end
    end

    shake.intensity = 3
end

function checkCollisions()
    if not player then return end

    -- Player hitbox
    local px, py = player.x, player.y
    local isMovingSlow = math.sqrt(player.lastDx^2 + player.lastDy^2) < 0.5
    local hitboxMult = upgrades:getHitboxMultiplier(cards.levels, isMovingSlow)
    local pRadius = 4 * hitboxMult

    -- Check if invincible
    local isMoving = player.lastDx ~= 0 or player.lastDy ~= 0
    local invincible = upgrades:isInvincible(cards.levels, isMoving)

    if invincible then return end

    -- Bullet-player collision
    for i = #bullets, 1, -1 do
        local b = bullets[i]
        local dist = math.sqrt((px - b.x)^2 + (py - b.y)^2)

        if dist < pRadius + (b.currentRadius or b.radius) then
            -- Try shield first
            if upgrades:tryAbsorbBullet(cards.levels) then
                -- Bullet absorbed!
                spawnParticle(b.x, b.y, 0, 0, {0.3, 0.7, 1, 1}, 0.3)
                table.remove(bullets, i)
            else
                -- Take damage
                table.remove(bullets, i)
                playerHit()
                if not player then return end
            end
        end
    end

    -- Enemy-player collision (contact damage)
    for i, e in ipairs(enemies) do
        if e.alive then
            local dist = math.sqrt((px - e.x)^2 + (py - e.y)^2)
            if dist < pRadius + 5 then
                -- Try shield
                if upgrades:tryAbsorbBullet(cards.levels) then
                    -- Contact absorbed (uses shield charge)
                    spawnParticle(player.x, player.y, 0, 0, {0.3, 0.7, 1, 1}, 0.3)
                else
                    playerHit()
                    if not player then return end
                end
            end
        end
    end
end

function playerHit()
    player.hp = player.hp - 1
    shake.intensity = 5

    -- Hit sound
    Sounds.play("hit")

    -- Haptic feedback on damage (heavy vibration)
    Bridge.triggerHaptic("heavy")

    -- Trigger i-frames
    upgrades:triggerIFrames(cards.levels)

    -- Hit particles
    for i = 1, 10 do
        local angle = love.math.random() * math.pi * 2
        spawnParticle(player.x, player.y, math.cos(angle) * 50, math.sin(angle) * 50, {1, 0.3, 0.3, 1}, 0.4)
    end

    if player.hp <= 0 then
        playerDeath()
    end
end

function startPracticeGame()
    isPracticeGame = true
    beginGameCountdown()
end

function beginGameCountdown()
    -- Play door entry sound
    Sounds.play("door")

    -- Reset countdown sounds for new game
    countdownSoundsPlayed = { three = false, two = false, one = false, go = false }

    -- Reset game state
    survivalTime = 0
    cardTimer = 0
    humidity = 1
    score = 0
    enemies = {}
    bullets = {}
    particles = {}

    -- Reset cards and upgrades
    cards = Cards.new()
    upgrades = Upgrades.new()

    -- Create player
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()
    local extraHP = upgrades:getExtraHP(cards.levels)
    player = {
        x = w / 2,
        y = h / 2,
        facingLeft = false,
        hp = 3 + extraHP,
        maxHp = 3 + extraHP,
        lastDx = 0,
        lastDy = 0,
    }

    -- Generate character if not already
    if not playerCharacter then
        local seed = Bridge.characterSeed or love.math.random(1, 999999999)
        playerCharacter = Character.new(seed)
    end

    -- Start countdown
    countdownTimer = 3.5
    state = STATE.COUNTDOWN
end

function startGame()
    -- Called after countdown ends or directly for blockchain games
    if state ~= STATE.COUNTDOWN then
        -- Direct start (from blockchain callback)
        isPracticeGame = false
        beginGameCountdown()
    else
        -- Countdown finished, transition to game
        state = STATE.GAME

        -- Initial enemies
        for i = 1, 2 do
            spawnEnemy()
        end
    end
end

function playerDeath()
    state = STATE.DEATH
    shake.intensity = 10

    -- Death sound
    Sounds.play("death")

    -- Death explosion
    if player then
        for i = 1, 25 do
            local angle = (i / 25) * math.pi * 2
            local color = playerCharacter:getMainColor()
            spawnParticle(
                player.x, player.y,
                math.cos(angle) * 70 + love.math.random(-20, 20),
                math.sin(angle) * 70 + love.math.random(-20, 20),
                {color[1], color[2], color[3], 1},
                1.2
            )
        end
    end

    player = nil

    -- Only submit score for real games, not practice
    if not isPracticeGame then
        Bridge.submitScore(math.floor(survivalTime * 1000))
    end
end

function love.draw()
    pixelCanvas:startDraw()

    love.graphics.push()
    love.graphics.translate(math.floor(shake.x), math.floor(shake.y))

    if state == STATE.MENU then
        drawMenu()
    elseif state == STATE.LOUNGE then
        drawLounge()
    elseif state == STATE.COUNTDOWN then
        drawCountdown()
    elseif state == STATE.GAME or state == STATE.CARD_SELECT then
        drawGame()
    elseif state == STATE.DEATH then
        drawDeath()
    end

    -- Draw particles
    drawParticles()

    love.graphics.pop()

    -- Card selection overlay
    if state == STATE.CARD_SELECT then
        local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()
        cards:draw(w, h)
    end

    -- Draw touch controls (in game and lounge)
    if state == STATE.GAME or state == STATE.LOUNGE then
        touchControls:draw()
    end

    -- Apply CRT shader effect
    local shader = crtEnabled and crtShader or nil
    pixelCanvas:endDraw(shader, gameTime)
end

function drawMenu()
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()

    -- Draw Sauna in background (dimmed)
    if sauna then
        sauna:drawBackground(gameTime)
    end

    -- Dark overlay
    love.graphics.setColor(0, 0, 0, 0.7)
    love.graphics.rectangle("fill", 0, 0, w, h)

    -- Title with glow effect
    love.graphics.setFont(fonts.large)

    -- Glow
    local pulse = 0.7 + math.sin(gameTime * 2) * 0.3
    love.graphics.setColor(0, 1, 1, 0.3 * pulse)
    love.graphics.printf("MOISTURE", -1, h * 0.25 - 1, w, "center")
    love.graphics.printf("MOISTURE", 1, h * 0.25 + 1, w, "center")

    -- Main title
    love.graphics.setColor(0, 1, 1, 1)
    love.graphics.printf("MOISTURE", 0, h * 0.25, w, "center")

    -- Subtitle
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(0.7, 0.7, 0.7, 0.8)
    love.graphics.printf("The Viscous High-Stakes Survivor", 0, h * 0.25 + 22, w, "center")

    -- Character preview
    if playerCharacter then
        love.graphics.setColor(1, 1, 1, 1)
        playerCharacter:drawPreview(w / 2, h * 0.45, 2)
    end

    -- Buttons
    local btnW, btnH = 100, 24
    local btnX = (w - btnW) / 2
    local connectY = h * 0.62
    local guestY = h * 0.72

    -- Connect Wallet button (cyan)
    local connectHover = isButtonHovered(btnX, connectY, btnW, btnH)
    local connectAlpha = connectHover and 0.9 or 0.7
    love.graphics.setColor(0, 0.8, 0.8, connectAlpha * 0.3)
    love.graphics.rectangle("fill", btnX, connectY, btnW, btnH, 4, 4)
    love.graphics.setColor(0, 1, 1, connectAlpha)
    love.graphics.rectangle("line", btnX, connectY, btnW, btnH, 4, 4)
    love.graphics.setFont(fonts.small)
    love.graphics.printf("CONNECT WALLET", btnX, connectY + 8, btnW, "center")

    -- Continue as Guest button (gray)
    local guestHover = isButtonHovered(btnX, guestY, btnW, btnH)
    local guestAlpha = guestHover and 0.9 or 0.5
    love.graphics.setColor(0.5, 0.5, 0.5, guestAlpha * 0.3)
    love.graphics.rectangle("fill", btnX, guestY, btnW, btnH, 4, 4)
    love.graphics.setColor(0.7, 0.7, 0.7, guestAlpha)
    love.graphics.rectangle("line", btnX, guestY, btnW, btnH, 4, 4)
    love.graphics.printf("PLAY AS GUEST", btnX, guestY + 8, btnW, "center")

    -- Footer hint
    love.graphics.setColor(0.5, 0.5, 0.5, 0.5)
    love.graphics.printf("Guests can practice for free", 0, h - 20, w, "center")
end

function drawLounge()
    -- Use the Sauna lounge system
    if sauna and playerCharacter then
        sauna:draw(playerCharacter, gameTime, fonts, isGuest)
    end
end

function drawCountdown()
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()

    -- Dark background
    love.graphics.setColor(0, 0, 0, 0.9)
    love.graphics.rectangle("fill", 0, 0, w, h)

    -- Countdown number
    local num = math.ceil(countdownTimer)
    local text = num > 0 and tostring(num) or "GO!"

    -- Scale effect
    local scale = 1 + (countdownTimer % 1) * 0.5

    love.graphics.setFont(fonts.large)

    -- Glow
    local r, g, b = 0, 1, 1
    if num <= 0 then
        r, g, b = 0, 1, 0.5
    end

    love.graphics.setColor(r, g, b, 0.3)
    love.graphics.printf(text, -2, h/2 - 12, w, "center")
    love.graphics.printf(text, 2, h/2 - 8, w, "center")

    -- Main text
    love.graphics.setColor(r, g, b, 1)
    love.graphics.printf(text, 0, h/2 - 10, w, "center")

    -- Practice mode indicator
    if isPracticeGame then
        love.graphics.setFont(fonts.small)
        love.graphics.setColor(0.3, 0.8, 0.5, 0.8)
        love.graphics.printf("PRACTICE MODE", 0, h/2 + 30, w, "center")
    end
end

-- Helper function for button hover detection
function isButtonHovered(x, y, w, h)
    local mx, my = love.mouse.getPosition()
    local gx, gy = pixelCanvas:toGame(mx, my)
    return gx >= x and gx <= x + w and gy >= y and gy <= y + h
end

function drawGame()
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()

    -- Background gradient based on humidity (danger level)
    local dangerTint = math.min(0.15, (humidity - 1) * 0.03)
    for y = 0, h, 8 do
        local gradAlpha = (y / h) * 0.1 + dangerTint
        love.graphics.setColor(0.1 + dangerTint, 0, 0.05 + dangerTint * 0.5, gradAlpha)
        love.graphics.rectangle("fill", 0, y, w, 8)
    end

    -- Subtle grid pattern
    love.graphics.setColor(0.15, 0.1, 0.2, 0.1)
    for x = 0, w, 16 do
        love.graphics.line(x, 0, x, h)
    end
    for y = 0, h, 16 do
        love.graphics.line(0, y, w, y)
    end

    -- Draw upgrade effects (behind everything)
    if player then
        upgrades:draw(player.x, player.y, cards.levels, gameTime)
    end

    -- Draw enemies
    for _, e in ipairs(enemies) do
        if e.alive then
            -- Update spawn effect
            if e.spawnEffect and e.spawnEffect > 0 then
                e.spawnEffect = e.spawnEffect - love.timer.getDelta()
            end

            -- Hit flash or spawn effect
            if e.hitFlash and e.hitFlash > 0 then
                love.graphics.setColor(1, 1, 1, 1)
                e.hitFlash = e.hitFlash - love.timer.getDelta()
            elseif e.spawnEffect and e.spawnEffect > 0 then
                -- Spawn glow effect
                local glow = e.spawnEffect / 0.5
                love.graphics.setColor(0.6 + glow * 0.4, 0.3 + glow * 0.4, 0.9, 0.3 + glow * 0.5)
                love.graphics.circle("fill", e.x, e.y, 8 + glow * 6)
                love.graphics.setColor(1, 1, 1, 0.5 + glow * 0.5)
            else
                love.graphics.setColor(1, 1, 1, 1)
            end
            local scale = e.facingLeft and -1 or 1
            -- Draw sprite if available, otherwise fallback to rectangle
            if e.sprite then
                love.graphics.draw(e.sprite, math.floor(e.x), math.floor(e.y + e.bobOffset), 0, scale, 1, 5, 6)
            else
                -- Fallback: draw colored rectangle
                love.graphics.setColor(0.8, 0.3, 0.3, 1)
                love.graphics.rectangle("fill", e.x - 5, e.y - 6, 10, 12)
            end

            -- Health bar for damaged enemies
            if e.health < e.maxHealth then
                local barW = 8
                local barH = 2
                local hpPct = e.health / e.maxHealth
                love.graphics.setColor(0.3, 0.3, 0.3, 0.8)
                love.graphics.rectangle("fill", e.x - barW/2, e.y - 8, barW, barH)
                love.graphics.setColor(1, 0.3, 0.3, 1)
                love.graphics.rectangle("fill", e.x - barW/2, e.y - 8, barW * hpPct, barH)
            end
        end
    end

    -- Draw bullets (with glow effect)
    for _, b in ipairs(bullets) do
        local radius = b.currentRadius or b.radius

        -- Color based on bounce count
        local r, g, bl
        if b.bounces == 0 then
            r, g, bl = 1, 0.3, 0.3  -- Red = dangerous
        elseif b.bounces == 1 then
            r, g, bl = 1, 0.8, 0.3  -- Orange = 1 bounce
        else
            r, g, bl = 0.3, 1, 0.5  -- Green = friendly (2+ bounces)
        end

        -- Outer glow
        love.graphics.setColor(r, g, bl, 0.15)
        love.graphics.circle("fill", b.x, b.y, radius * 2)
        -- Middle glow
        love.graphics.setColor(r, g, bl, 0.4)
        love.graphics.circle("fill", b.x, b.y, radius * 1.3)
        -- Core
        love.graphics.setColor(r, g, bl, 1)
        love.graphics.circle("fill", b.x, b.y, radius)

        -- Highlight center
        love.graphics.setColor(1, 1, 1, 0.8)
        love.graphics.circle("fill", b.x, b.y, radius * 0.35)
    end

    -- Draw player
    if player and playerCharacter then
        -- Invincibility flash
        local isMoving = player.lastDx ~= 0 or player.lastDy ~= 0
        if upgrades:isInvincible(cards.levels, isMoving) then
            love.graphics.setColor(1, 1, 1, 0.4 + math.sin(gameTime * 15) * 0.3)
        else
            love.graphics.setColor(1, 1, 1, 1)
        end
        -- Use stored visual scale for consistent TINY effect
        local visualScale = player.visualScale or 1
        playerCharacter:draw(math.floor(player.x), math.floor(player.y), visualScale, player.facingLeft)
    end

    -- HUD
    love.graphics.setFont(fonts.small)

    -- Active upgrades
    upgrades:drawUI(w, h, cards.levels)

    -- Time and score panel (top right)
    love.graphics.setColor(0, 0, 0, 0.5)
    love.graphics.rectangle("fill", w - 45, 2, 43, 24, 3)
    love.graphics.setColor(0.3, 0.8, 1, 0.4)
    love.graphics.rectangle("line", w - 45, 2, 43, 24, 3)

    love.graphics.setColor(1, 1, 1, 0.9)
    love.graphics.printf(string.format("%.1fs", survivalTime), 0, 5, w - 5, "right")

    -- Score with thousands separator
    local scoreText = string.format("%d", score)
    if score >= 1000 then
        scoreText = string.format("%.1fk", score / 1000)
    end
    love.graphics.setColor(1, 0.85, 0.3, 1)
    love.graphics.printf(scoreText, 0, 15, w - 5, "right")

    -- HP hearts (larger, with animation)
    if player then
        local heartScale = 1.0
        local lowHpFlash = player.hp <= 1 and (0.7 + math.sin(gameTime * 8) * 0.3) or 1

        for i = 1, player.maxHp do
            local hx = 4 + (i - 1) * 12
            local hy = h - 14

            -- Shadow
            love.graphics.setColor(0, 0, 0, 0.3)
            love.graphics.circle("fill", hx + 3.5 + 1, hy + 5 + 1, 5)

            if i <= player.hp then
                -- Filled heart with glow
                love.graphics.setColor(1 * lowHpFlash, 0.2, 0.2, 0.3)
                love.graphics.circle("fill", hx + 3.5, hy + 4, 6)
                love.graphics.setColor(1 * lowHpFlash, 0.3, 0.3, 1)
                love.graphics.circle("fill", hx + 2, hy + 3, 3)
                love.graphics.circle("fill", hx + 5, hy + 3, 3)
                love.graphics.polygon("fill", hx, hy + 4, hx + 7, hy + 4, hx + 3.5, hy + 9)
                -- Highlight
                love.graphics.setColor(1, 0.6, 0.6, 0.6)
                love.graphics.circle("fill", hx + 1.5, hy + 2, 1)
            else
                -- Empty heart
                love.graphics.setColor(0.25, 0.25, 0.25, 0.6)
                love.graphics.circle("fill", hx + 2, hy + 3, 3)
                love.graphics.circle("fill", hx + 5, hy + 3, 3)
                love.graphics.polygon("fill", hx, hy + 4, hx + 7, hy + 4, hx + 3.5, hy + 9)
            end
        end
    end

    -- Next card timer with seconds remaining
    local cardPct = cardTimer / CARD_INTERVAL
    local secondsLeft = math.ceil(CARD_INTERVAL - cardTimer)

    -- Timer background
    love.graphics.setColor(0, 0, 0, 0.4)
    love.graphics.rectangle("fill", w/2 - 28, h - 10, 56, 8, 2)

    -- Timer fill
    local timerPulse = cardPct > 0.8 and (0.8 + math.sin(gameTime * 6) * 0.2) or 1
    love.graphics.setColor(0.3 * timerPulse, 0.85 * timerPulse, 1 * timerPulse, 0.9)
    love.graphics.rectangle("fill", w/2 - 27, h - 9, 54 * cardPct, 6, 2)

    -- Timer border
    love.graphics.setColor(0.4, 0.7, 0.9, 0.6)
    love.graphics.rectangle("line", w/2 - 28, h - 10, 56, 8, 2)

    -- Seconds remaining (when close)
    if secondsLeft <= 3 and cardPct > 0 then
        love.graphics.setColor(1, 1, 1, 0.9)
        love.graphics.printf(tostring(secondsLeft), w/2 - 28, h - 9, 56, "center")
    end

    -- Humidity/difficulty indicator
    if humidity >= 2 then
        local pulse = 0.6 + math.sin(gameTime * 6) * 0.4
        love.graphics.setColor(1, 0.3, 0.2, pulse)
        love.graphics.setFont(fonts.medium)
        love.graphics.printf("!", w - 18, 3, 15, "center")
    end
end

function drawDeath()
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()

    -- Animated dark overlay with vignette
    love.graphics.setColor(0, 0, 0, 0.85)
    love.graphics.rectangle("fill", 0, 0, w, h)

    -- Red pulsing vignette at edges
    local pulse = 0.3 + math.sin(gameTime * 2) * 0.1
    for i = 1, 5 do
        local thickness = i * 8
        local alpha = pulse * (1 - i / 6)
        love.graphics.setColor(0.3, 0, 0, alpha)
        love.graphics.rectangle("line", thickness, thickness, w - thickness * 2, h - thickness * 2)
    end

    -- Title with glow
    love.graphics.setFont(fonts.large)

    if isPracticeGame then
        -- Practice mode - green tint
        love.graphics.setColor(0.2, 0.8, 0.5, 0.3 + math.sin(gameTime * 3) * 0.1)
        love.graphics.printf("PRACTICE", -1, h/2 - 61, w, "center")
        love.graphics.printf("PRACTICE", 1, h/2 - 59, w, "center")
        love.graphics.setColor(0.3, 0.9, 0.6)
        love.graphics.printf("PRACTICE", 0, h/2 - 60, w, "center")
    else
        -- Real game - red tint
        love.graphics.setColor(1, 0.2, 0.2, 0.3 + math.sin(gameTime * 3) * 0.1)
        love.graphics.printf("EVAPORATED", -1, h/2 - 61, w, "center")
        love.graphics.printf("EVAPORATED", 1, h/2 - 59, w, "center")
        love.graphics.setColor(1, 0.3, 0.3)
        love.graphics.printf("EVAPORATED", 0, h/2 - 60, w, "center")
    end

    -- Character ghost
    if playerCharacter then
        love.graphics.setColor(1, 1, 1, 0.3)
        playerCharacter:drawPreview(w / 2, h/2 - 10, 2)
    end

    -- Stats
    love.graphics.setFont(fonts.medium)
    love.graphics.setColor(1, 1, 1)
    love.graphics.printf(string.format("Time: %.2fs", survivalTime), 0, h/2 + 30, w, "center")

    love.graphics.setColor(1, 0.8, 0.2)
    love.graphics.printf(string.format("Score: %d", score), 0, h/2 + 50, w, "center")

    -- Retry prompt
    love.graphics.setFont(fonts.small)
    love.graphics.setColor(0.7, 0.7, 0.7, 0.5 + math.sin(gameTime * 3) * 0.3)
    love.graphics.printf("TAP TO RETRY", 0, h/2 + 90, w, "center")
end

function drawParticles()
    for _, p in ipairs(particles) do
        local alpha = (p.life / p.maxLife) * (p.color[4] or 1)
        love.graphics.setColor(p.color[1], p.color[2], p.color[3], alpha)
        love.graphics.rectangle("fill", math.floor(p.x) - 1, math.floor(p.y) - 1, 2, 2)
    end
end

-- Input handlers
function love.textinput(text)
    if state == STATE.LOUNGE and sauna then
        sauna:handleTextInput(text)
    end
end

function love.keypressed(key)
    -- Toggle CRT effect
    if key == "c" then
        crtEnabled = not crtEnabled
        return
    end

    if state == STATE.MENU then
        if key == "space" or key == "return" then
            -- Enter as guest
            isGuest = true
            state = STATE.LOUNGE
        elseif key == "w" then
            -- Connect wallet
            Bridge.requestWalletConnect()
        end
    elseif state == STATE.LOUNGE then
        -- Handle chat input first
        if sauna and sauna:handleKeyPressed(key) then
            return
        end

        -- Other keyboard shortcuts (only when chat not active)
        if sauna and not sauna.chatInputActive then
            if key == "space" or key == "return" then
                if sauna.nearDoor then
                    -- Enter through door
                    if sauna.isPracticeMode then
                        startPracticeGame()
                    elseif Bridge.walletConnected and Bridge.isEntryAllowed() then
                        Bridge.requestEnterGame()
                    elseif isGuest then
                        startPracticeGame()
                    end
                end
            elseif key == "p" then
                -- Toggle practice mode when near door
                if sauna.nearDoor then
                    sauna.isPracticeMode = not sauna.isPracticeMode
                end
            end
        end
    elseif state == STATE.CARD_SELECT then
        local selectedCard = cards:keypressed(key)
        if selectedCard then
            applyCardEffect(selectedCard)
            state = STATE.GAME
        end
    elseif state == STATE.DEATH then
        if key == "space" or key == "return" then
            state = STATE.LOUNGE
        end
    elseif state == STATE.GAME then
        if key == "escape" then
            playerDeath()
        elseif key == "space" or key == "lshift" or key == "rshift" then
            -- Blink
            tryBlink()
        end
    end
end

function applyCardEffect(card)
    -- Play pickup sound
    Sounds.playVaried("pickup", 0.6, 0.15)

    -- Handle heart upgrade specially
    if card.id == "heart" and player then
        player.maxHp = 3 + cards.levels.heart
        player.hp = player.hp + 1
    end
end

function tryBlink()
    if player then
        local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()
        local blinked, newX, newY = upgrades:tryBlink(
            cards.levels,
            player.lastDx, player.lastDy,
            player.x, player.y,
            w, h
        )
        if blinked then
            -- Haptic feedback on successful blink (light vibration)
            Bridge.triggerHaptic("light")

            -- Blink particles at old position
            for i = 1, 6 do
                local angle = (i / 6) * math.pi * 2
                spawnParticle(player.x, player.y, math.cos(angle) * 30, math.sin(angle) * 30, {1, 0.7, 0.3, 1}, 0.3)
            end
            player.x = newX
            player.y = newY
            -- Blink particles at new position
            for i = 1, 6 do
                local angle = (i / 6) * math.pi * 2
                spawnParticle(player.x, player.y, math.cos(angle) * 20, math.sin(angle) * 20, {1, 0.7, 0.3, 0.5}, 0.2)
            end
        end
    end
end

function love.mousepressed(x, y, button)
    local gx, gy = pixelCanvas:toGame(x, y)
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()

    if state == STATE.MENU then
        -- Menu button handling
        local btnW, btnH = 100, 24
        local btnX = (w - btnW) / 2
        local connectY = h * 0.62
        local guestY = h * 0.72

        -- Connect Wallet button
        if gx >= btnX and gx <= btnX + btnW and gy >= connectY and gy <= connectY + btnH then
            Sounds.play("click")
            Bridge.requestWalletConnect()
            return
        end

        -- Play as Guest button
        if gx >= btnX and gx <= btnX + btnW and gy >= guestY and gy <= guestY + btnH then
            Sounds.play("click")
            isGuest = true
            state = STATE.LOUNGE
            return
        end
    elseif state == STATE.LOUNGE then
        if sauna then
            -- Check chat input click
            if sauna:isChatInputClicked(gx, gy) then
                sauna.chatInputActive = true
                return
            elseif sauna:isSendButtonClicked(gx, gy) then
                Sounds.play("click")
                sauna:sendChat()
                return
            else
                -- Clicked elsewhere, deactivate chat input
                sauna.chatInputActive = false
            end

            -- Check door toggle (play/practice mode)
            local toggle = sauna:isDoorToggleClicked(gx, gy)
            if toggle then
                Sounds.play("click")
                sauna.isPracticeMode = (toggle == "practice")
                return
            end

            -- Check door enter button
            if sauna:isDoorEnterClicked(gx, gy) then
                Sounds.play("click")
                if sauna.isPracticeMode then
                    startPracticeGame()
                elseif Bridge.walletConnected and Bridge.isEntryAllowed() then
                    Bridge.requestEnterGame()
                elseif isGuest then
                    -- Guest can only practice
                    sauna.isPracticeMode = true
                    startPracticeGame()
                else
                    Bridge.requestWalletConnect()
                end
                return
            end
        end
    elseif state == STATE.CARD_SELECT then
        local selectedCard = cards:touchpressed(gx, gy, w, h)
        if selectedCard then
            applyCardEffect(selectedCard)
            state = STATE.GAME
        end
    elseif state == STATE.DEATH then
        state = STATE.LOUNGE
    elseif state == STATE.GAME then
        -- Right click = blink
        if button == 2 then
            tryBlink()
        end
    end
end

function rerollCharacter()
    Bridge.characterSeed = os.time() + love.math.random(1, 999999)
    playerCharacter = Character.new(Bridge.characterSeed)
end

function love.touchpressed(id, x, y, dx, dy, pressure)
    touchControls:touchpressed(id, x, y)

    local gx, gy = pixelCanvas:toGame(x, y)
    local w, h = pixelCanvas:getWidth(), pixelCanvas:getHeight()

    if state == STATE.MENU then
        -- Menu button handling (same as mousepressed)
        local btnW, btnH = 100, 24
        local btnX = (w - btnW) / 2
        local connectY = h * 0.62
        local guestY = h * 0.72

        -- Connect Wallet button
        if gx >= btnX and gx <= btnX + btnW and gy >= connectY and gy <= connectY + btnH then
            Sounds.play("click")
            Bridge.requestWalletConnect()
            return
        end

        -- Play as Guest button
        if gx >= btnX and gx <= btnX + btnW and gy >= guestY and gy <= guestY + btnH then
            Sounds.play("click")
            isGuest = true
            state = STATE.LOUNGE
            return
        end
    elseif state == STATE.LOUNGE then
        if sauna then
            -- Check chat input click
            if sauna:isChatInputClicked(gx, gy) then
                sauna.chatInputActive = true
                love.keyboard.setTextInput(true)  -- Enable on-screen keyboard on mobile
                return
            elseif sauna:isSendButtonClicked(gx, gy) then
                Sounds.play("click")
                sauna:sendChat()
                return
            else
                -- Clicked elsewhere, deactivate chat input
                sauna.chatInputActive = false
                love.keyboard.setTextInput(false)
            end

            -- Check door toggle (play/practice mode)
            local toggle = sauna:isDoorToggleClicked(gx, gy)
            if toggle then
                Sounds.play("click")
                sauna.isPracticeMode = (toggle == "practice")
                return
            end

            -- Check door enter button
            if sauna:isDoorEnterClicked(gx, gy) then
                Sounds.play("click")
                if sauna.isPracticeMode then
                    startPracticeGame()
                elseif Bridge.walletConnected and Bridge.isEntryAllowed() then
                    Bridge.requestEnterGame()
                elseif isGuest then
                    -- Guest can only practice
                    sauna.isPracticeMode = true
                    startPracticeGame()
                else
                    Bridge.requestWalletConnect()
                end
                return
            end
        end
    elseif state == STATE.CARD_SELECT then
        local selectedCard = cards:touchpressed(gx, gy, w, h)
        if selectedCard then
            applyCardEffect(selectedCard)
            state = STATE.GAME
        end
    elseif state == STATE.DEATH then
        state = STATE.LOUNGE
    elseif state == STATE.GAME then
        -- Tap on right side = blink
        local controlZoneY = h * 0.6
        if gy > controlZoneY and gx >= w / 2 then
            tryBlink()
        end
    end
end

function love.touchmoved(id, x, y, dx, dy, pressure)
    touchControls:touchmoved(id, x, y)
end

function love.touchreleased(id, x, y, dx, dy, pressure)
    touchControls:touchreleased(id, x, y)
end
