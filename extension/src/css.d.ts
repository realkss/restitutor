// esbuild loads .css imports as text (scripts/build-ext.mjs loader config).
declare module "*.css" {
  const text: string
  export default text
}
