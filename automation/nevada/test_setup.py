"""Execute the actual Lua controller with a simulated bridge, never the game."""
import ctypes
from pathlib import Path
import unittest

DLL = Path('C:/Program Files/Cheat Engine 7.5/lua53-64.dll')
SOURCE = Path(__file__).with_name('setup.lua').read_text(encoding='utf-8')
MOCK = r'''
local now, session, status, body = 0, '1-2', 'READY', 'mock'
local sent, stops, buffers, reads = {}, {}, 0, 0
local inventory=false
local state={x=46180,y=-3790,z=58052,yaw=-16979,state=2,anim=103,frame=1610,room=116}
local reject, drift, lost = false,false,false
local adapter={now=function() return now end,
  status=function() return session..'|'..status..'|'..body end,
  stop=function(s) stops[#stops+1]=s end, log=function() end,
  send=function(s,id,op,arg)
    sent[#sent+1]=op
    if lost then return end
    if reject then status='REJECTED';body=id..': game not foreground';return end
    if op=='ESC' then inventory=true end
    if op=='BUFFERRIGHT' then buffers=buffers+1;state.yaw=state.yaw+900;state.state=6;state.anim=12 end
    if op=='BUFFERIDLE' then state.state=2;state.anim=103 end
    if drift and op=='BUFFERRIGHT' then state.x=state.x+1 end
    if op=='READ' and not inventory then state.frame=state.frame+1 end
    local fields={}
    for k,v in pairs(state) do fields[#fields+1]=k..'='..v end
    status='DONE';body=id..'|'..table.concat(fields,',')
  end}
local runner=M.new(adapter)
local function drive()
  for i=1,1000 do now=now+50;runner:tick();if runner.phase~='running' then return end end
  error('Runner did not finish')
end
'''


@unittest.skipUnless(DLL.exists(), 'Local CE Lua 5.3 runtime unavailable')
class SetupTests(unittest.TestCase):
    def run_lua(self, case):
        lua = ctypes.CDLL(str(DLL))
        lua.luaL_newstate.restype = ctypes.c_void_p
        lua.luaL_openlibs.argtypes = [ctypes.c_void_p]
        lua.luaL_loadstring.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
        lua.lua_pcallk.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int,
                                 ctypes.c_int, ctypes.c_longlong, ctypes.c_void_p]
        lua.lua_tolstring.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_void_p]
        lua.lua_tolstring.restype = ctypes.c_char_p
        lua.lua_close.argtypes = [ctypes.c_void_p]
        state = lua.luaL_newstate()
        self.assertTrue(state)
        try:
            lua.luaL_openlibs(state)
            code = 'local M=(function()\n' + SOURCE + '\nend)()\n' + MOCK + case
            result = lua.luaL_loadstring(state, code.encode())
            if result == 0:
                result = lua.lua_pcallk(state, 0, 0, 0, 0, None)
            error = lua.lua_tolstring(state, -1, None) if result else b''
            self.assertEqual(result, 0, error.decode(errors='replace'))
        finally:
            lua.lua_close(state)

    def test_counted_turn_and_no_write_commands(self):
        self.run_lua("""
runner:start('turn',15);drive()
assert(runner.phase=='complete' and buffers==15 and #stops==0 and inventory)
local allowed={READ=true,ESC=true,BUFFERRIGHT=true,BUFFERIDLE=true}
for _,op in ipairs(sent) do assert(allowed[op]) end
""")

    def test_wrong_start_sends_no_input(self):
        self.run_lua("state.x=0;runner:start('turn',15);drive();assert(runner.phase=='failed' and #sent==1 and #stops==1)")

    def test_drift_stops_first_buffer(self):
        self.run_lua("drift=true;runner:start('turn',15);drive();assert(runner.phase=='failed' and buffers==1 and #stops==1)")

    def test_focus_rejection_is_not_retried(self):
        self.run_lua("reject=true;runner:start('turn',15);drive();assert(runner.phase=='failed' and #sent==1 and #stops==1)")

    def test_timeout_stops(self):
        self.run_lua("lost=true;runner:start('turn',15);drive();assert(runner.phase=='failed' and #sent==1 and #stops==1)")

    def test_new_session_only_stops_old_session(self):
        self.run_lua("runner:start('turn',15);session='3-4';drive();assert(runner.phase=='failed' and #sent==0 and stops[1]=='1-2')")

    def test_unknown_trial_and_count_rejected(self):
        self.run_lua("assert(not pcall(function() runner:start('route',15) end)); assert(not pcall(function() runner:start('turn',21) end));assert(#sent==0)")

    def test_crouch_requires_master_pickup(self):
        self.run_lua("runner:start('crouch');drive();assert(runner.phase=='failed' and #sent==1)")


if __name__ == '__main__':
    unittest.main()
