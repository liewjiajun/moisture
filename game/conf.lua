function love.conf(t)
    t.identity = "moisture"
    t.version = "11.5"
    t.console = false

    -- Portrait orientation for mobile-first
    t.window.title = "MOISTURE"
    t.window.width = 450
    t.window.height = 800
    t.window.minwidth = 180
    t.window.minheight = 320
    t.window.resizable = true
    t.window.vsync = 1
    t.window.msaa = 0
    t.window.depth = nil
    t.window.stencil = nil
    t.window.display = 1
    t.window.highdpi = true

    t.modules.audio = true
    t.modules.data = true
    t.modules.event = true
    t.modules.font = true
    t.modules.graphics = true
    t.modules.image = false
    t.modules.joystick = false
    t.modules.keyboard = true
    t.modules.math = true
    t.modules.mouse = true
    t.modules.physics = false
    t.modules.sound = true
    t.modules.system = true
    t.modules.thread = false
    t.modules.timer = true
    t.modules.touch = true
    t.modules.video = false
    t.modules.window = true
end
