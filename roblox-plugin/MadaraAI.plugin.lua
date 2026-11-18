--!strict
-- Madara AI Studio Connector
-- Install as a local Roblox Studio plugin. This plugin sends prompts to the Madara AI web API
-- and inserts the returned Luau files into the matching Roblox services.
-- It never asks for or stores a Roblox password, cookie, or Open Cloud API key.

local HttpService = game:GetService("HttpService")

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
	local warningCount = 0
	if type(decoded.agentNotes) == "table" then
		for _, note in ipairs(decoded.agentNotes) do
			if type(note) == "string" and string.find(string.lower(note), "warning", 1, true) then
				warningCount += 1
			end
		end
	end
	setStatus(
		"Project ready: " .. tostring(decoded.projectName or "Roblox Game")
			.. "\n" .. tostring(#decoded.files) .. " files generated."
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
		if child and not child:IsA("Folder") then
			return false, "A non-folder already exists at " .. folderName
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

insertButton.Activated:Connect(function()
	if busy or type(generatedProject) ~= "table" or type(generatedProject.files) ~= "table" then
		return
	end
	local answer = plugin:GetSetting("MadaraAIInsertConfirmed")
	if answer ~= true then
		setStatus("Before first insert: check the generated files. Press Insert again to confirm that same-path scripts may be replaced.", Color3.fromRGB(255, 190, 90))
		plugin:SetSetting("MadaraAIInsertConfirmed", true)
		return
	end

	busy = true
	local inserted = 0
	local failures = {}
	for _, file in ipairs(generatedProject.files) do
		local ok, message = insertFile(file)
		if ok then
			inserted += 1
		else
			table.insert(failures, message)
		end
	end

	if #failures == 0 then
		setStatus("Inserted " .. tostring(inserted) .. " scripts. Press Play and test the game. Save a backup before publishing.", COLORS.green)
	else
		setStatus("Inserted " .. tostring(inserted) .. " files; " .. tostring(#failures) .. " failed:\n" .. table.concat(failures, "\n"), COLORS.red)
	end
	busy = false
end)

OPEN_BUTTON.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

widget.Enabled = true
