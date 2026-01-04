-- Simple ECS (Entity Component System) implementation
local ECS = {}
ECS.__index = ECS

function ECS.new()
    local self = setmetatable({}, ECS)
    self.entities = {}
    self.systems = {}
    self.nextId = 1
    return self
end

function ECS:entity(components)
    local id = self.nextId
    self.nextId = self.nextId + 1
    self.entities[id] = components or {}
    self.entities[id]._id = id
    return self.entities[id]
end

function ECS:remove(entity)
    if entity and entity._id then
        self.entities[entity._id] = nil
    end
end

function ECS:addSystem(system)
    table.insert(self.systems, system)
end

function ECS:query(...)
    local required = {...}
    local results = {}
    for _, entity in pairs(self.entities) do
        local matches = true
        for _, comp in ipairs(required) do
            if not entity[comp] then
                matches = false
                break
            end
        end
        if matches then
            table.insert(results, entity)
        end
    end
    return results
end

function ECS:update(dt)
    for _, system in ipairs(self.systems) do
        if system.update then
            system:update(self, dt)
        end
    end
end

function ECS:draw()
    for _, system in ipairs(self.systems) do
        if system.draw then
            system:draw(self)
        end
    end
end

function ECS:clear()
    self.entities = {}
    self.nextId = 1
end

return ECS
