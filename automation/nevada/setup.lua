-- Input-only Nevada calibration over the existing CE file bridge.
-- Loading this module does nothing. Timers advance one acknowledged command at a time.
local M = {}
M.reference = {
  initial = {x=46180,y=-3790,z=58052,yaw=-16979,state=2,anim=103,room=116},
  lower = {x=46181,y=-3681,z=58800,yaw=-3250,state=2,room=116},
  pickup = {x=45090,y=-3839,z=60942,yaw=-3250,state=67,anim=312,frame=8693,room=116},
  crouch = {x=45090,y=-3799,z=60942,yaw=-3250,state=71,anim=222,frame=6675,room=116}
}
M.candidate = {
  angleStart={x=46181,y=-3669,z=58845,yaw=-15744,state=2,anim=103,room=116},
  lower={x=46181,y=-3669,z=58845,yaw=-3336,state=2,anim=103,room=116},
  pickup={x=45089,y=-3816,z=60902,yaw=-3336,state=67,anim=312,frame=8693,room=116},
  crouch={x=45089,y=-3820,z=60902,yaw=-3336,state=71,anim=222,frame=6675,room=116}
}
local function matches(state, expected)
  for k,v in pairs(expected) do
    assert(state[k] == v, 'Checkpoint mismatch: '..k..' expected '..v..', got '..tostring(state[k]))
  end
end
local function parse(text)
  local state = {}
  for k,v in text:gmatch('(%a+)=(-?%d+)') do state[k]=tonumber(v) end
  for _,k in ipairs({'x','y','z','yaw','state','anim','frame','room'}) do
    assert(state[k] ~= nil, 'Incomplete READ: '..k)
  end
  return state
end
local allowed = {READ=true,ESC=true,BUFFERRIGHT=true,BUFFERLEFT=true,BUFFERIDLE=true,BUFFERDUCK=true}

-- ioAdapter: now(), status(), send(session,id,op,arg), stop(session), log(event,text).
-- No key injection, process attachment, memory writes, loading, or saving in this module.
function M.new(ioAdapter)
  local r = {io=ioAdapter, sequence=0, phase='idle'}
  local function status()
    local session,phase,body = r.io.status():match('^(%d+%-%d+)|([^|]+)|(.*)')
    assert(session, 'Invalid bridge status')
    return session,phase,body
  end
  local function command(op,arg)
    assert(allowed[op], 'Command not allowed: '..tostring(op))
    return coroutine.yield({op=op,arg=arg or 0})
  end
  local function read() return parse(command('READ')) end
  local function wait(ms) coroutine.yield({wait=ms}) end
  local function frozen(expected)
    local a=read(); matches(a,expected); wait(350)
    matches(read(),a)
    return a
  end
  function r:start(kind, count)
    assert(self.phase=='idle', 'Use a new runner for each trial')
    assert(kind=='turn' or kind=='crouch' or kind=='candidate-angle' or kind=='candidate-crouch' or kind=='master-angle',
      'Supported trials: turn, crouch, candidate-angle, candidate-crouch, master-angle')
    if kind=='turn' then
      assert(type(count)=='number' and count%1==0 and count>=1 and count<=20, 'Choose 1..20 right buffers')
    end
    local session,phase = status()
    assert(phase=='READY' or phase=='DONE' or phase=='REJECTED', 'Bridge is busy, paused, or stopped')
    self.session=session
    self.phase='running'
    self.co=coroutine.create(function()
      if kind=='turn' then
        local a=read(); matches(a,M.reference.initial); wait(400)
        local b=read(); matches(b,M.reference.initial)
        assert(a.frame~=b.frame, 'Start with inventory closed and game running')
        command('ESC',100)
        frozen(M.reference.initial)
        for i=1,count+2 do
          command(i<=count and 'BUFFERRIGHT' or 'BUFFERIDLE',180)
          local state=frozen({x=46180,y=-3790,z=58052,room=116})
          assert(state.state==2 or state.state==6 or state.state==7 or state.state==20,
            'Unexpected state during turning')
        end
        -- This measures a candidate. It does not claim the master yaw was reached.
      elseif kind=='master-angle' then
        frozen({x=46181,y=-3681,z=58800,yaw=-16384,room=116,state=2,anim=103})
        local sequence='RRRRRRRIIRLLLLLRRRRRRRRRRRLII'
        local commands={R='BUFFERRIGHT',L='BUFFERLEFT',I='BUFFERIDLE'}
        for symbol in sequence:gmatch('.') do
          command(commands[symbol],180)
          frozen({x=46181,y=-3681,z=58800,room=116})
        end
        frozen({x=46181,y=-3681,z=58800,yaw=-3250,room=116,state=2,anim=103})
      elseif kind=='candidate-angle' then
        frozen(M.candidate.angleStart)
        local sequence={}
        for i=1,11 do sequence[#sequence+1]='BUFFERRIGHT' end
        for i=1,3 do sequence[#sequence+1]='BUFFERIDLE' end
        sequence[#sequence+1]='BUFFERRIGHT'
        for i=1,2 do sequence[#sequence+1]='BUFFERIDLE' end
        for _,op in ipairs(sequence) do
          command(op,180)
          frozen({x=46181,y=-3669,z=58845,room=116})
        end
        frozen(M.candidate.lower)
      else
        local reference=kind=='candidate-crouch' and M.candidate or M.reference
        frozen(reference.pickup)
        for i=1,19 do
          command('BUFFERDUCK',180)
          local a=frozen({x=reference.pickup.x,z=reference.pickup.z,yaw=reference.pickup.yaw,room=116})
          if i<19 then matches(a,{state=67,anim=312}) end
        end
        frozen(reference.crouch)
      end
    end)
    self.io.log('start',kind..':'..tostring(count or 19))
  end
  function r:cancel(reason)
    if self.phase~='running' then return end
    self.phase='failed'; self.error=reason or 'Cancelled'
    -- A session-tagged stop cannot cancel a replacement bridge session.
    local ok,err=pcall(self.io.stop,self.session)
    if not ok then self.error=self.error..'; stop failed: '..tostring(err) end
    pcall(self.io.log,'failed',self.error)
  end
  function r:tick()
    if self.phase~='running' then return end
    local ok,err=pcall(function()
      local session,phase,body=status()
      assert(session==self.session, 'Bridge session changed')
      assert(phase~='PAUSED' and phase~='STOPPED', 'Bridge '..phase)
      local reply=nil
      if self.pending then
        local p=self.pending
        assert(self.io.now() < p.deadline, 'Bridge acknowledgement timeout')
        local own=body==p.id or body:sub(1,#p.id+1)==p.id..'|' or body:sub(1,#p.id+1)==p.id..':'
        if not own then return end
        assert(phase~='REJECTED',body)
        if phase~='DONE' then return end
        reply=body; self.pending=nil; self.io.log('reply',body)
      elseif self.wake then
        if self.io.now()<self.wake then return end
        self.wake=nil
      end
      local success,request=coroutine.resume(self.co,reply)
      assert(success,request)
      if coroutine.status(self.co)=='dead' then
        self.phase='complete'; self.io.log('complete','Trial completed; inventory remains open'); return
      end
      if request.wait then self.wake=self.io.now()+request.wait; return end
      self.sequence=self.sequence+1
      local id='nevada-'..self.runId..'-'..self.sequence
      self.pending={id=id,deadline=self.io.now()+15000}
      self.io.log('command',id..'|'..request.op..'|'..request.arg)
      self.io.send(self.session,id,request.op,request.arg)
    end)
    if not ok then self:cancel(tostring(err)) end
  end
  r.runId=tostring(ioAdapter.now())..'-'..tostring(math.random(100000,999999))
  return r
end

-- Call explicitly from CE after attaching and starting the existing bridge.
-- root is the local analysis project's temple-mudslide directory, not this repository.
function M.startCE(root,kind,count)
  assert(not _G.nevadaSetup or _G.nevadaSetup.phase~='running', 'A Nevada trial is already running')
  root=root:gsub('\\','/'):gsub('/$','')..'/runtime/'
  local function load(name)
    local f=assert(io.open(root..name,'r')); local value=f:read('*a'); f:close(); return value
  end
  local function save(name,value)
    local f=assert(io.open(root..name,'w')); assert(f:write(value)); assert(f:close())
  end
  local logName='nevada-setup-'..os.time()..'-'..getTickCount()..'.log'
  local runner=M.new({now=getTickCount,status=function() return load('ce_bridge_status.txt') end,
    send=function(session,id,op,arg) save('ce_bridge_command.txt',session..'|'..id..'|'..op..'|'..arg) end,
    stop=function(session) save('ce_bridge_stop.txt',session) end,
    log=function(event,value)
      local f=assert(io.open(root..logName,'a'))
      assert(f:write(getTickCount()..'\t'..event..'\t'..value..'\n')); assert(f:close())
    end})
  runner:start(kind,count)
  runner.timer=createTimer(nil,false); runner.timer.Interval=25
  runner.timer.OnTimer=function()
    runner:tick()
    if runner.phase~='running' then runner.timer.Enabled=false end
  end
  runner.timer.Enabled=true
  _G.nevadaSetup=runner
  return runner
end
return M
