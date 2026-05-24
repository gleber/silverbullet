import type { ParseTree } from "@silverbulletmd/silverbullet/lib/tree";
import {
  allLanguageNames,
  languageFor,
  loadLanguageFor,
} from "../../languages.ts";
import { parse } from "../../markdown_parser/parse_tree.ts";
import type { SysCallMapping } from "../system.ts";

export function languageSyscalls(): SysCallMapping {
  return {
    "language.parseLanguage": async (
      _ctx,
      language: string,
      code: string,
    ): Promise<ParseTree> => {
      const lang = languageFor(language) ?? (await loadLanguageFor(language));
      if (!lang) {
        throw new Error(`Unknown language ${language}`);
      }
      return parse(lang, code);
    },
    "language.listLanguages": (): string[] => {
      return allLanguageNames;
    },
  };
}
