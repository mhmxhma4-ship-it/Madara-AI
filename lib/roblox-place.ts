export type RobloxGeneratedFile = { path: string; kind: string; code: string };
export type RobloxScenePart = {
  name: string;
  parentPath?: string;
  className?: "Part" | "SpawnLocation";
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  color: { r: number; g: number; b: number };
  material?: string;
  shape?: "Block" | "Ball" | "Cylinder";
  rotation?: { x: number; y: number; z: number };
  anchored?: boolean;
  canCollide?: boolean;
  transparency?: number;
};

type Node = { className: string; name: string; properties: string[]; children: Node[] };

const SERVICES = new Set([
  "Workspace", "ReplicatedStorage", "ServerScriptService", "ServerStorage",
  "StarterGui", "StarterPlayer", "Lighting", "SoundService", "TextChatService",
]);
const MATERIALS: Record<string, number> = {
  Plastic: 256, SmoothPlastic: 272, Neon: 288, Wood: 512, WoodPlanks: 528,
  Metal: 1088, DiamondPlate: 1104, Foil: 1120, CorrodedMetal: 1136,
  Grass: 1280, Sand: 1296, Brick: 1312, Concrete: 1328, Granite: 1344,
  Marble: 1360, Slate: 1376, Rock: 1392, Ice: 1536, Glass: 1568,
};

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function number(value: number): string {
  if (!Number.isFinite(value)) throw new Error("The generated place contains a non-finite number.");
  return String(Math.round(value * 100000) / 100000);
}
function property(tag: string, name: string, value: string): string {
  return `<${tag} name="${xml(name)}">${value}</${tag}>`;
}
function vectorProperty(name: string, value: { x: number; y: number; z: number }): string {
  return `<Vector3 name="${xml(name)}"><X>${number(value.x)}</X><Y>${number(value.y)}</Y><Z>${number(value.z)}</Z></Vector3>`;
}
function cframe(position: { x: number; y: number; z: number }, rotation = { x: 0, y: 0, z: 0 }): string {
  const x = rotation.x * Math.PI / 180, y = rotation.y * Math.PI / 180, z = rotation.z * Math.PI / 180;
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  const matrix = [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
  const fields = ["R00", "R01", "R02", "R10", "R11", "R12", "R20", "R21", "R22"];
  return `<CoordinateFrame name="CFrame"><X>${number(position.x)}</X><Y>${number(position.y)}</Y><Z>${number(position.z)}</Z>${fields.map((field, index) => `<${field}>${number(matrix[index])}</${field}>`).join("")}</CoordinateFrame>`;
}
function instanceXml(node: Node, id: { value: number }): string {
  const referent = `RBX${id.value++}`;
  const props = node.properties.join("");
  return `<Item class="${xml(node.className)}" referent="${referent}"><Properties>${property("string", "Name", xml(node.name))}${props}</Properties>${node.children.map(child => instanceXml(child, id)).join("")}</Item>`;
}
function addChild(parent: Node, className: string, name: string): Node {
  let child = parent.children.find(item => item.name === name);
  if (child) {
    if (child.className !== className && !(child.className === "Folder" && className === "Folder")) {
      throw new Error(`Conflicting generated Roblox objects at "${name}".`);
    }
    return child;
  }
  child = { className, name, properties: [], children: [] };
  parent.children.push(child);
  return child;
}
function safePath(path: string): string[] {
  if (path.length > 180 || path.startsWith("/") || path.includes("\\") || /[<>:"|?*\u0000-\u001f]/.test(path)) {
    throw new Error(`Unsafe generated Roblox path: ${path}`);
  }
  const parts = path.split("/");
  if (parts.length < 2 || parts.some(part => !part || part === "." || part === "..") || !SERVICES.has(parts[0])) {
    throw new Error(`Unsupported generated Roblox path: ${path}`);
  }
  return parts;
}
function uniqueSceneName(parent: Node, requestedName: string): string {
  const used = new Set(parent.children.map(child => child.name.toLowerCase()));
  if (!used.has(requestedName.toLowerCase())) return requestedName;
  let suffix = 2;
  while (used.has(`${requestedName}_${suffix}`.toLowerCase())) suffix += 1;
  return `${requestedName}_${suffix}`;
}

function addSceneFolder(parent: Node, requestedName: string): Node {
  const existingFolder = parent.children.find(child =>
    child.className === "Folder" && child.name.toLowerCase() === requestedName.toLowerCase()
  );
  if (existingFolder) return existingFolder;
  const name = uniqueSceneName(parent, requestedName);
  const folder: Node = { className: "Folder", name, properties: [], children: [] };
  parent.children.push(folder);
  return folder;
}

function addPart(workspace: Node, part: RobloxScenePart): void {
  if (!part || typeof part.name !== "string" || !part.position || !part.size || !part.color) {
    throw new Error("The scene plan contains an incomplete 3D object.");
  }
  const parentSegments = (part.parentPath || "MadaraAI_World").split("/");
  if (parentSegments.length > 8 || parentSegments.some(segment => segment === "." || segment === ".." || !/^[A-Za-z0-9 _-]{1,50}$/.test(segment))) {
    throw new Error(`Unsafe scene folder path for "${part.name}".`);
  }
  if (!/^[A-Za-z0-9 _-]{1,50}$/.test(part.name)) throw new Error("A scene object has an invalid name.");
  let parent = workspace;
  for (const segment of parentSegments) parent = addSceneFolder(parent, segment);
  const className = part.className === "SpawnLocation" ? "SpawnLocation" : "Part";
  const color = [part.color.r, part.color.g, part.color.b].map(channel => Math.max(0, Math.min(1, channel)));
  const material = MATERIALS[part.material || "Plastic"] ?? MATERIALS.Plastic;
  const shape = part.shape === "Ball" ? 1 : part.shape === "Cylinder" ? 2 : 0;
  const transparency = Math.max(0, Math.min(1, part.transparency ?? 0));
  const properties = [
    property("bool", "Anchored", String(part.anchored ?? true)),
    property("bool", "CanCollide", String(part.canCollide ?? true)),
    cframe(part.position, part.rotation),
    vectorProperty("Size", part.size),
    `<Color3 name="Color3"><R>${number(color[0])}</R><G>${number(color[1])}</G><B>${number(color[2])}</B></Color3>`,
    property("token", "Material", String(material)),
    property("token", "shape", String(shape)),
    property("float", "Transparency", number(transparency)),
  ];
  if (className === "SpawnLocation") {
    properties.push(property("bool", "AllowTeamChangeOnTouch", "true"));
    properties.push(property("float", "Duration", "0"));
    properties.push(property("bool", "Enabled", "true"));
  }

  const existing = parent.children.find(child => child.name.toLowerCase() === part.name.toLowerCase());
  if (existing && existing.className === className && existing.properties.join("") === properties.join("")) return;
  const name = existing ? uniqueSceneName(parent, part.name) : part.name;
  parent.children.push({ className, name, properties, children: [] });
}
function addScript(root: Node, file: RobloxGeneratedFile): void {
  const parts = safePath(file.path);
  const service = parts.shift()!;
  const fileName = parts.pop()!;
  if (!fileName.toLowerCase().endsWith(".lua")) throw new Error(`Generated script must end in .lua: ${file.path}`);
  if (file.code.length > 60000) throw new Error(`Generated script is too large: ${file.path}`);
  let className: string;
  if (file.kind === "server") className = "Script";
  else if (file.kind === "client") className = "LocalScript";
  else if (file.kind === "module") className = "ModuleScript";
  else throw new Error(`Unsupported generated script type: ${file.path}`);
  const name = fileName.replace(/\.(server|client|module)\.lua$/i, "").replace(/\.lua$/i, "");
  if (!name || !/^[A-Za-z0-9 _.-]{1,100}$/.test(name)) throw new Error(`Invalid script name: ${file.path}`);
  let parent = root.children.find(child => child.name === service)!;
  for (const segment of parts) {
    const specialClass = service === "StarterPlayer" && ["StarterPlayerScripts", "StarterCharacterScripts"].includes(segment)
      ? segment : "Folder";
    parent = addChild(parent, specialClass, segment);
  }
  if (parent.children.some(child => child.name === name)) throw new Error(`Duplicate generated script name: ${file.path}`);
  const safeCode = file.code.replace(/\]\]>/g, "]]]]><![CDATA[>");
  parent.children.push({
    className, name,
    properties: [
      property("bool", "Disabled", "false"),
      `<ProtectedString name="Source"><![CDATA[${safeCode}]]></ProtectedString>`,
    ],
    children: [],
  });
}

export function buildRobloxPlaceXml(project: {
  projectName?: string;
  files?: RobloxGeneratedFile[];
  environmentPlan?: RobloxScenePart[];
}): string {
  const files = Array.isArray(project.files) ? project.files.filter(file => file && file.kind !== "readme") : [];
  const parts = Array.isArray(project.environmentPlan) ? project.environmentPlan : [];
  if (files.length === 0 && parts.length === 0) throw new Error("This generation has no scripts or 3D objects to export.");
  if (files.length > 100 || parts.length > 100) throw new Error("This generated place exceeds the safe export limit of 100 scripts and 100 scene objects.");
  const root: Node = { className: "DataModel", name: project.projectName?.trim().slice(0, 100) || "MadaraAI_Game", properties: [], children: [] };
  for (const service of ["Workspace", "ReplicatedStorage", "ServerScriptService", "ServerStorage", "StarterGui", "StarterPlayer", "Lighting", "SoundService", "TextChatService"]) {
    root.children.push({ className: service, name: service, properties: [], children: [] });
  }
  const workspace = root.children.find(child => child.name === "Workspace")!;
  for (const part of parts) addPart(workspace, part);
  for (const file of files) addScript(root, file);
  const body = instanceXml(root, { value: 0 });
  return `<?xml version="1.0" encoding="utf-8"?>
<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" version="4">
<External>null</External>
<External>nil</External>
${body}
</roblox>`;
}
