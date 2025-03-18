export const unsortedLanguageOptions = [
  { value: "rust", label: "rust" },
  { value: "javascript", label: "javascript" },
  { value: "jsx", label: "jsx" },
  { value: "typescript", label: "typescript" },
  { value: "tsx", label: "tsx" },
  { value: "python", label: "python" },
  { value: "html", label: "html" },
  { value: "css", label: "css" },
  { value: "json", label: "json" },
  { value: "c", label: "c" },
  { value: "cpp", label: "c++" },
  { value: "csharp", label: "c#" },
  { value: "regex", label: "regex" },
  { value: "bash", label: "bash" },
  { value: "elixir", label: "elixir" },
  { value: "erlang", label: "erlang" },
  { value: "haskell", label: "haskell" },
  { value: "graphql", label: "graphql" },
  { value: "kotlin", label: "kotlin" },
  { value: "lua", label: "lua" },
  { value: "markdown", label: "markdown" },
  { value: "php", label: "php" },
  { value: "ruby", label: "ruby" },
  { value: "scala", label: "scala" },
  { value: "sql", label: "sql" },
  { value: "swift", label: "swift" },
  { value: "yaml", label: "yaml" },
  { value: "java", label: "java" },
  { value: "lisp", label: "lisp" },
  { value: "odin", label: "odin" },
  { value: "pascal", label: "pascal" },
  { value: "perl", label: "perl" },
  { value: "powershell", label: "powershell" },
];

export const languageOptions = [...unsortedLanguageOptions].sort((a, b) =>
  a.label.localeCompare(b.label)
);

// Map language to Prism language identifier
export const getPrismLanguage = (lang: string): string => {
  const languageMap: Record<string, string> = {
    rust: "rust",
    cpp: "cpp",
    c: "c",
    js: "javascript",
    javascript: "javascript",
    jsx: "jsx",
    ts: "typescript",
    typescript: "typescript",
    tsx: "tsx",
    html: "markup",
    xml: "markup",
    css: "css",
    py: "python",
    python: "python",
    json: "json",
    regex: "regex",
    bash: "bash",
    elixir: "elixir",
    erlang: "erlang",
    haskell: "haskell",
    graphql: "graphql",
    kotlin: "kotlin",
    csharp: "csharp",
    lua: "lua",
    markdown: "markdown",
    php: "php",
    ruby: "ruby",
    scala: "scala",
    sql: "sql",
    swift: "swift",
    yaml: "yaml",
    java: "java",
    lisp: "lisp",
    odin: "odin",
    pascal: "pascal",
    perl: "perl",
    powershell: "powershell",
  };

  return languageMap[lang.toLowerCase()] || "none";
};

export const getLanguageLabel = (lang: string): string => {
  const option = languageOptions.find(
    (opt) => opt.value === getPrismLanguage(lang).replace("markup", "html")
  );

  return option?.label || "none";
};
