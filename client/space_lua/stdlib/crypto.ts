import { hashSHA256 } from "../../../plug-api/lib/crypto.ts";
import { LuaBuiltinFunction, LuaTable } from "../runtime.ts";

export const cryptoApi = new LuaTable({
  sha256: new LuaBuiltinFunction(
    (_sf, s: string | Uint8Array): Promise<string> => {
      return hashSHA256(s);
    },
  ),
});
