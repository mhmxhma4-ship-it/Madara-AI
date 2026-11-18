--!strict
-- Madara AI Studio Connector
-- Install as a local Roblox Studio plugin. This plugin sends prompts to the Madara AI web API
-- and inserts the returned Luau files into the matching Roblox services.
-- It never asks for or stores a Roblox password, cookie, or Open Cloud API key.

local HttpService = game:GetService("HttpService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local TOOLBAR = plugin:CreateToolbar("Madara AI")
local OPEN_BUTTON = TOOLBAR:CreateButton("OpenMadaraAI", "Open the Madara AI game builder", "")
OPEN_BUTTON.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right,
	false,
	true,
	420,
	600,
	340,
	420
)

local widget = plugin:CreateDockWidgetPluginGuiAsync("MadaraAIStudioConnector", widgetInfo)
widget.Title = "Madara AI - Roblox Builder"

local COLORS = {
	background = Color3.fromRGB(15, 17, 25),
	panel = Color3.fromRGB(25, 29, 41),
	field = Color3.fromRGB(34, 39, 54),
	text = Color3.fromRGB(241, 244, 255),
	muted = Color3.fromRGB(153, 163, 185),
	accent = Color3.fromRGB(142, 92, 255),
	green = Color3.fromRGB(68, 205, 145),
	red = Color3.fromRGB(255, 112, 124),
}

local function make(className: string, properties: {[string]: any}, parent: Instance): Instance
	local object = Instance.new(className)
	for key, value in pairs(properties) do
		(object :: any)[key] = value
	end
	object.Parent = parent
	return object
end

local root = make("Frame", {
	Name = "Root",
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = COLORS.background,
	BorderSizePixel = 0,
}, widget) :: Frame

make("UIPadding", {
	PaddingTop = UDim.new(0, 16),
	PaddingBottom = UDim.new(0, 16),
	PaddingLeft = UDim.new(0, 16),
	PaddingRight = UDim.new(0, 16),
}, root)

make("UIListLayout", {
	FillDirection = Enum.FillDirection.Vertical,
	SortOrder = Enum.SortOrder.LayoutOrder,
	Padding = UDim.new(0, 10),
}, root)

make("TextLabel", {
	LayoutOrder = 1,
	Size = UDim2.new(1, 0, 0, 30),
	BackgroundTransparency = 1,
	Text = "MADARA AI",
	TextColor3 = COLORS.text,
	TextSize = 22,
	Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left,
}, root)

make("TextLabel", {
	LayoutOrder = 2,
	Size = UDim2.new(1, 0, 0, 34),
	BackgroundTransparency = 1,
	Text = "Describe your game. AI agents will plan it, build the world and write Luau scripts.",
	TextColor3 = COLORS.muted,
	TextSize = 12,
	Font = Enum.Font.Gotham,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	TextYAlignment = Enum.TextYAlignment.Top,
}, root)

local endpoint = make("TextBox", {
	LayoutOrder = 3,
	Size = UDim2.new(1, 0, 0, 34),
	BackgroundColor3 = COLORS.field,
	BorderSizePixel = 0,
	Text = "https://madara-ai.vercel.app",
	PlaceholderText = "Madara AI website URL",
	TextColor3 = COLORS.text,
	PlaceholderColor3 = COLORS.muted,
	TextSize = 12,
	Font = Enum.Font.Gotham,
	ClearTextOnFocus = false,
	TextXAlignment = Enum.TextXAlignment.Left,
}, root) :: TextBox
make("UICorner", {CornerRadius = UDim.new(0, 8)}, endpoint)
make("UIPadding", {PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10)}, endpoint)

local mode = "Full game"
local modeButton = make("TextButton", {
	LayoutOrder = 4,
	Size = UDim2.new(1, 0, 0, 34),
	BackgroundColor3 = COLORS.panel,
	BorderSizePixel = 0,
	Text = "Mode: Full game  (tap to change)",
	TextColor3 = COLORS.text,
	TextSize = 12,
	Font = Enum.Font.GothamSemibold,
	AutoButtonColor = true,
}, root) :: TextButton
make("UICorner", {CornerRadius = UDim.new(0, 8)}, modeButton)

local modes = {"Full game", "Game map", "Gameplay system", "UI interface", "Lua script"}
local modeIndex = 1
modeButton.Activated:Connect(function()
	modeIndex = (modeIndex % #modes) + 1
	mode = modes[modeIndex]
	modeButton.Text = "Mode: " .. mode .. "  (tap to change)"
end)

local prompt = make("TextBox", {
	LayoutOrder = 5,
	Size = UDim2.new(1, 0, 0, 150),
	BackgroundColor3 = COLORS.field,
	BorderSizePixel = 0,
	Text = "",
	PlaceholderText = "Example: Create an anime simulator with 5 worlds, followers, quests, boss fights, upgrades and rebirths...",
	TextColor3 = COLORS.text,
	PlaceholderColor3 = COLORS.muted,
	TextSize = 13,
	Font = Enum.Font.Gotham,
	ClearTextOnFocus = false,
	MultiLine = true,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	TextYAlignment = Enum.TextYAlignment.Top,
}, root) :: TextBox
make("UICorner", {CornerRadius = UDim.new(0, 8)}, prompt)
make("UIPadding", {
	PaddingTop = UDim.new(0, 10),
	PaddingBottom = UDim.new(0, 10),
	PaddingLeft = UDim.new(0, 10),
	PaddingRight = UDim.new(0, 10),
}, prompt)

local generateButton = make("TextButton", {
	LayoutOrder = 6,
	Size = UDim2.new(1, 0, 0, 42),
	BackgroundColor3 = COLORS.accent,
	BorderSizePixel = 0,
	Text = "Generate with AI agents",
	TextColor3 = COLORS.text,
	TextSize = 14,
	Font = Enum.Font.GothamBold,
}, root) :: TextButton
make("UICorner", {CornerRadius = UDim.new(0, 9)}, generateButton)

local insertButton = make("TextButton", {
	LayoutOrder = 7,
	Size = UDim2.new(1, 0, 0, 42),
	BackgroundColor3 = COLORS.green,
	BorderSizePixel = 0,
	Text = "Insert generated scripts into Studio",
	TextColor3 = Color3.fromRGB(12, 24, 21),
	TextSize = 13,
	Font = Enum.Font.GothamBold,
	Visible = false,
}, root) :: TextButton
make("UICorner", {CornerRadius = UDim.new(0, 9)}, insertButton)

local status = make("TextLabel", {
	LayoutOrder = 8,
	Size = UDim2.new(1, 0, 0, 72),
	BackgroundColor3 = COLORS.panel,
	BorderSizePixel = 0,
	Text = "Ready. Enter a game idea and generate your project.",
	TextColor3 = COLORS.muted,
	TextSize = 12,
	Font = Enum.Font.Gotham,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
	TextYAlignment = Enum.TextYAlignment.Top,
}, root) :: TextLabel
make("UICorner", {CornerRadius = UDim.new(0, 8)}, status)
make("UIPadding", {
	PaddingTop = UDim.new(0, 9),
	PaddingBottom = UDim.new(0, 8),
	PaddingLeft = UDim.new(0, 9),
	PaddingRight = UDim.new(0, 9),
}, status)

make("TextLabel", {
	LayoutOrder = 9,
	Size = UDim2.new(1, 0, 0, 42),
	BackgroundTransparency = 1,
	Text = "Review generated code before running it. Inserting a file with the same path updates that script. Test in Studio before publishing.",
	TextColor3 = COLORS.muted,
	TextSize = 10,
	Font = Enum.Font.Gotham,
	TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
}, root)

local generatedProject: any = nil
local busy = false
local pendingInsertConfirmation = false

local function setStatus(message: string, color: Color3?)
	status.Text = message
	status.TextColor3 = color or COLORS.muted
end

local function normalizedBaseUrl(): string?
	local value = string.gsub(endpoint.Text, "%s+", "")
	value = string.gsub(value, "/+$", "")
	if not string.match(value, "^https://[%w%.%-]+") then
		return nil
	end
	return value
end

generateButton.Activated:Connect(function()
	if busy then return end
	if #prompt.Text < 5 then
		setStatus("Describe your game idea first.", COLORS.red)
		return
	end

	local baseUrl = normalizedBaseUrl()
	if not baseUrl then
		setStatus("Enter a valid HTTPS website URL.", COLORS.red)
		return
	end

	busy = true
	generateButton.Text = "AI agents are working..."
	insertButton.Visible = false
	generatedProject = nil
	setStatus("Connecting to Madara AI. The agents are planning and generating your project...")

	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = baseUrl .. "/api/generate",
			Method = "POST",
			Headers = {["Content-Type"] = "application/json"},
			Body = HttpService:JSONEncode({
				prompt = prompt.Text,
				mode = mode,
			}),
		})
	end)

	if not ok then
		setStatus("Connection failed. Check the website URL and allow HTTP requests for this plugin. Details: " .. tostring(result), COLORS.red)
		busy = false
		generateButton.Text = "Generate with AI agents"
		return
	end

	if not result.Success then
		local message = "Madara AI returned HTTP " .. tostring(result.StatusCode)
		local decodedOk, decoded = pcall(function()
			return HttpService:JSONDecode(result.Body)
		end)
		if decodedOk and type(decoded) == "table" and type(decoded.error) == "string" then
			message = decoded.error
		end
		setStatus(message, COLORS.red)
		busy = false
		generateButton.Text = "Generate with AI agents"
		return
	end

	local decodedOk, decoded = pcall(function()
		return HttpService:JSONDecode(result.Body)
	end)
	if not decodedOk or type(decoded) ~= "table" or type(decoded.files) ~= "table" or #decoded.files == 0 then
		setStatus("Madara AI returned an invalid project response.", COLORS.red)
		busy = false
		generateButton.Text = "Generate with AI agents"
		return
	end

	generatedProject = decoded
	pendingInsertConfirmation = false
	local warningCount = 0
	if type(decoded.agentNotes) == "table" then
		for _, note in ipairs(decoded.agentNotes) do
			if type(note) == "string" and string.find(string.lower(note), "warning", 1, true) then
				warningCount += 1
			end
		end
	end
	local sceneCount = type(decoded.environmentPlan) == "table" and #decoded.environmentPlan or 0
	setStatus(
		"Project ready: " .. tostring(decoded.projectName or "Roblox Game")
			.. "\n" .. tostring(#decoded.files) .. " scripts + " .. tostring(sceneCount) .. " 3D objects."
			.. (warningCount > 0 and (" Review warnings: " .. tostring(warningCount) .. ".") or "")
			.. "\nTap Insert only after reviewing the project.",
		warningCount > 0 and Color3.fromRGB(255, 190, 90) or COLORS.green
	)
	insertButton.Visible = true
	busy = false
	generateButton.Text = "Generate again"
end)

local allowedServices: {[string]: boolean} = {
	ServerScriptService = true,
	ReplicatedStorage = true,
	ServerStorage = true,
	StarterGui = true,
	StarterPlayer = true,
	Workspace = true,
}

local function safeSegments(path: string): {string}?
	if #path > 180 or string.find(path, "..", 1, true) or string.find(path, "\\", 1, true) then
		return nil
	end
	local segments = string.split(path, "/")
	if #segments < 2 or not allowedServices[segments[1]] then
		return nil
	end
	for _, segment in ipairs(segments) do
		if segment == "" or string.find(segment, "[<>:\"|%?%*]") then
			return nil
		end
	end
	return segments
end

local function insertFile(file: any): (boolean, string)
	if type(file) ~= "table" or type(file.path) ~= "string" or type(file.code) ~= "string" then
		return false, "Invalid file entry."
	end
	local segments = safeSegments(file.path)
	if not segments then
		return false, "Blocked unsafe or unsupported path: " .. file.path
	end
	if #file.code > 60000 then
		return false, "File is too large: " .. file.path
	end

	local parent: Instance = game:GetService(segments[1])
	for index = 2, #segments - 1 do
		local folderName = segments[index]
		local child = parent:FindFirstChild(folderName)
		if child and child:IsA("LuaSourceContainer") then
			return false, "A script already exists where a folder is required: " .. folderName
		end
		if not child then
			local folder = Instance.new("Folder")
			folder.Name = folderName
			folder.Parent = parent
			child = folder
		end
		parent = child
	end

	local fileName = segments[#segments]
	local className: string
	if file.kind == "server" then
		className = "Script"
	elseif file.kind == "client" then
		className = "LocalScript"
	elseif file.kind == "module" then
		className = "ModuleScript"
	else
		return false, "Unsupported script type for " .. file.path
	end

	local existing = parent:FindFirstChild(fileName)
	local scriptObject: LuaSourceContainer
	if existing then
		if not existing:IsA(className) then
			return false, "A different object type already exists at " .. file.path
		end
		scriptObject = existing :: LuaSourceContainer
	else
		scriptObject = Instance.new(className) :: LuaSourceContainer
		scriptObject.Name = fileName
		scriptObject.Parent = parent
	end

	local sourceOk, sourceError = pcall(function()
		scriptObject.Source = file.code
	end)
	if not sourceOk then
		return false, "Could not write source for " .. file.path .. ": " .. tostring(sourceError)
	end
	return true, file.path
end

local function insertScenePart(part: any): (boolean, string)
	if type(part) ~= "table" or type(part.name) ~= "string" then return false, "Invalid 3D object entry." end
	local parentPath = type(part.parentPath) == "string" and part.parentPath or "World"
	if #parentPath > 120 or string.find(parentPath, "..", 1, true) or string.find(parentPath, "\\", 1, true) then return false, "Blocked unsafe scene folder path." end
	local parent: Instance = workspace:FindFirstChild("MadaraAI_Generated") or workspace
	for _, segment in ipairs(string.split(parentPath, "/")) do
		if segment == "" or segment == "." or string.find(segment, "[<>:\"|%?%*]") then return false, "Invalid scene folder name." end
		local folder = parent:FindFirstChild(segment)
		if folder and not folder:IsA("Folder") and not folder:IsA("Model") then return false, "A non-container object blocks the scene folder path: " .. segment end
		if not folder then
			local created = Instance.new("Folder")
			created.Name = segment
			created.Parent = parent
			folder = created
		end
		parent = folder
	end
	local className = part.className
	if className ~= "Part" and className ~= "SpawnLocation" then return false, "Unsupported 3D object type." end
	local position, size, color = part.position, part.size, part.color
	local rotation = part.rotation or {x = 0, y = 0, z = 0}
	local function validVector(value: any, minimum: number, maximum: number): boolean
		return type(value) == "table" and type(value.x) == "number" and type(value.y) == "number" and type(value.z) == "number"
			and value.x == value.x and value.y == value.y and value.z == value.z
			and math.abs(value.x) <= maximum and math.abs(value.y) <= maximum and math.abs(value.z) <= maximum
			and (minimum <= 0 or (value.x >= minimum and value.y >= minimum and value.z >= minimum))
	end
	if not validVector(position, -10000, 10000) or not validVector(size, 0.2, 512) or not validVector(rotation, -360, 360) then return false, "Invalid position, size or rotation for " .. part.name end
	if type(color) ~= "table" or type(color.r) ~= "number" or type(color.g) ~= "number" or type(color.b) ~= "number" then return false, "Invalid color for " .. part.name end
	local existing = parent:FindFirstChild(part.name)
	local object: BasePart
	if existing then
		if not existing:IsA(className) then return false, "A different object already exists at " .. part.name end
		object = existing :: BasePart
	else
		object = Instance.new(className) :: BasePart
		object.Name = part.name
		object.Parent = parent
	end
	object.Size = Vector3.new(math.clamp(size.x, 0.2, 512), math.clamp(size.y, 0.2, 512), math.clamp(size.z, 0.2, 512))
	object.CFrame = CFrame.new(position.x, position.y, position.z) * CFrame.Angles(math.rad(rotation.x), math.rad(rotation.y), math.rad(rotation.z))
	object.Color = Color3.new(math.clamp(color.r, 0, 1), math.clamp(color.g, 0, 1), math.clamp(color.b, 0, 1))
	local material = type(part.material) == "string" and Enum.Material[part.material] or nil
	object.Material = material or Enum.Material.SmoothPlastic
	if object:IsA("Part") then
		local shape = type(part.shape) == "string" and Enum.PartType[part.shape] or nil
		object.Shape = shape or Enum.PartType.Block
	end
	object.Anchored = part.anchored ~= false
	object.CanCollide = part.canCollide ~= false
	object.Transparency = type(part.transparency) == "number" and math.clamp(part.transparency, 0, 1) or 0
	if object:IsA("SpawnLocation") then
		object.Neutral = true
		object.Duration = 0
	end
	return true, parentPath .. "/" .. part.name
end

insertButton.Activated:Connect(function()
	if busy or type(generatedProject) ~= "table" or type(generatedProject.files) ~= "table" then
		return
	end
	if not pendingInsertConfirmation then
		pendingInsertConfirmation = true
		setStatus("Confirm insert: matching scripts will update and the MadaraAI_Generated map folder will be replaced. Press Insert again to continue.", Color3.fromRGB(255, 190, 90))
		return
	end
	pendingInsertConfirmation = false

	busy = true
	local recordingId = ChangeHistoryService:TryBeginRecording("MadaraAIInsert", "Insert generated Madara AI scripts")
	if not recordingId then
		busy = false
		setStatus("Studio could not start an undo recording. No scripts were inserted. Try again.", COLORS.red)
		return
	end
	local inserted = 0
	local objectsInserted = 0
	local failures = {}
	for _, file in ipairs(generatedProject.files) do
		local callOk, ok, message = pcall(insertFile, file)
		if callOk and ok then
			inserted += 1
		else
			table.insert(failures, callOk and message or tostring(ok))
		end
	end
	if type(generatedProject.environmentPlan) == "table" and #generatedProject.environmentPlan > 0 then
		local previousMap = workspace:FindFirstChild("MadaraAI_Generated")
		if previousMap and not previousMap:IsA("Folder") then
			table.insert(failures, "Workspace.MadaraAI_Generated exists but is not a Folder.")
		else
			if previousMap then previousMap:Destroy() end
			local newMap = Instance.new("Folder")
			newMap.Name = "MadaraAI_Generated"
			newMap.Parent = workspace
		end
		for _, part in ipairs(generatedProject.environmentPlan) do
			local callOk, ok, message = pcall(insertScenePart, part)
			if callOk and ok then
				objectsInserted += 1
			else
				table.insert(failures, callOk and message or tostring(ok))
			end
		end
	end

	if recordingId then
		ChangeHistoryService:FinishRecording(recordingId, Enum.FinishRecordingOperation.Commit)
	end
	if #failures == 0 then
		setStatus("Inserted " .. tostring(inserted) .. " scripts and built " .. tostring(objectsInserted) .. " 3D objects. You can Undo this insertion. Press Play and test the game; save a backup before publishing.", COLORS.green)
	else
		setStatus("Inserted " .. tostring(inserted) .. " scripts and " .. tostring(objectsInserted) .. " objects; " .. tostring(#failures) .. " failed:\n" .. table.concat(failures, "\n"), COLORS.red)
	end
	busy = false
end)

OPEN_BUTTON.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

widget.Enabled = true
