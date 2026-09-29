// Parser contract: pure binary input -> SceneBuilder's renderer-independent data.
// Parsers must bound reads/counts and never execute level-provided code.
export class LevelParser {
  matches(bytes){throw Error('Format detection is not implemented.');}
  parse(buffer,source,progress){throw Error('Level parsing is not implemented.');}
}
