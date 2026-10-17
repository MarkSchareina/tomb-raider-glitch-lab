import {TENParser} from './ten-parser.js';
import {TR3Parser} from './tr3-parser.js';

// Register future adapters here. Detection never depends on the filename.
const parserTypes=[TENParser,TR3Parser];
export function parseLevel(buffer,source,progress=()=>{}){
  if(buffer.byteLength>512*1024*1024)throw Error('The selected file exceeds the 512 MiB import limit.');
  const bytes=new Uint8Array(buffer);
  for(const Parser of parserTypes){const parser=new Parser();if(parser.matches(bytes))return parser.parse(buffer,source,progress);}
  throw Error('Unsupported level format. Open TEN 1.10.1.0 or a TR3 PC level (.tr2).');
}
