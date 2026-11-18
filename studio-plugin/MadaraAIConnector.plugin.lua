-- Madara AI Connector
-- Install as a local Studio plugin. Generated Luau is inserted as source; it is never executed by this plugin.

local HttpService = game:GetService("HttpService")

local API_URL = "https://madara-ai.vercel.app/api/generate"
local TOOLBAR_NAME = "Madara AI"
local WIDGET_ID = "MadaraAIConnectorWidget"

local toolbar = plugin:CreateToolbar(TOOLBAR_NAME)
local toggleButton = toolbar:CreateButton(
	"OpenMadaraAI",
	"Open Madara AI game builder",
	""
)
toggleButton.ClickableWhenViewportHidden = true

local widgetInfo = DockWidgetPluginGuiInfo.new(
	Enum.InitialDockState.Right,
	false,
	false,
	390,
	560,
	320,
	360
)

local widget = plugin:CreateDockWidgetPluginGuiAsync(WIDGET_ID, widgetInfo)
widget.Title = "Madara AI Connector"

local root = Instance.new("Frame")
root.Name = "Root"
root.Size = UDim2.fromScale(1, 1)
root.BackgroundColor3 = Color3.fromRGB(18, 20, 29)
root.BorderSizePixel = 0
root.Parent = widget

local padding = Instance.new("UIPadding")
padding.PaddingTop = UDim.new(0, 14)
padding.PaddingBottom = UDim.new(0, 14)
padding.PaddingLeft = UDim.new(0, 14)
padding.PaddingRight = UDim.new(0, 14)
padding.Parent = root

local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 10)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Parent = root

local function makeLabel(name, text, height, order, color, textSize)
	local label = Instance.new("TextLabel")
	label.Name = name
	label.Size = UDim2.new(1, 0, 0, height)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextColor3 = color or Color3.fromRGB(235, 238, 248)
	label.Font = Enum.Font.Gotham
	label.TextSize = textSize or 13
	label.TextWrapped = true
	label.TextXAlignment = Enum.TextXAlignment.Left
	label.TextYAlignment = Enum.TextYAlignment.Center
	label.LayoutOrder = order
	label.Parent = root
	return label
end

local heading = makeLabel("Heading", "MADARA AI  /  ROBLOX STUDIO", 28, 1, Color3.fromRGB(255, 85, 115), 17)
heading.Font = Enum.Font.GothamBold

makeLabel("Subheading", "Describe your game. Generate Luau. Insert it into Studio.", 34, 2, Color3.fromRGB(174, 181, 199), 12)

local promptBox = Instance.new("TextBox")
promptBox.Name = "GamePrompt"
promptBox.Size = UDim2.new(1, 0, 0, 118)
promptBox.BackgroundColor3 = Color3.fromRGB(29, 33, 46)
promptBox.BorderSizePixel = 0
promptBox.ClearTextOnFocus = false
promptBox.MultiLine = true
promptBox.TextWrapped = true
promptBox.TextXAlignment = Enum.TextXAlignment.Left
promptBox.TextYAlignment = Enum.TextYAlignment.Top
promptBox.Font = Enum.Font.Gotham
promptBox.TextSize = 13
promptBox.TextColor3 = Color3.fromRGB(245, 246, 250)
promptBox.PlaceholderColor3 = Color3.fromRGB(130, 138, 158)
promptBox.PlaceholderText = "Example: Create an anime training simulator with chakra, enemies, rebirths, and 3 worlds..."
promptBox.Text = ""
promptBox.LayoutOrder = 3
promptBox.Parent = root

local modeBox = Instance.new("TextBox")
modeBox.Name = "CreationMode"
modeBox.Size = UDim2.new(1, 0, 0, 34)
modeBox.BackgroundColor3 = Color3.fromRGB(29, 33, 46)
modeBox.BorderSizePixel = 0
modeBox.ClearTextOnFocus = false
modeBox.Font = Enum.Font.Gotham
modeBox.TextSize = 12
modeBox.TextColor3 = Color3.fromRGB(245, 246, 250)
modeBox.Text = "Full game"
modeBox.PlaceholderText = "Full game / Game map / Gameplay system / UI interface / Lua script"
modeBox.LayoutOrder = 4
modeBox.Parent = root

local function makeButton(name, text, order, color)
	local button = Instance.new("TextButton")
	button.Name = name
	button.Size = UDim2.new(1, 0, 0, 40)
	button.BackgroundColor3 = color
	button.BorderSizePixel = 0
	button.AutoButtonColor = true
	button.Font = Enum.Font.GothamBold
	button.TextSize = 13
	button.TextColor3 = Color3.fromRGB(255, 255, 255)
	button.Text = text
	button.LayoutOrder = order
	button.Parent = root
	return button
end

local generateButton = makeButton("GenerateButton", "GENERATE WITH MADARA AI", 5, Color3.fromRGB(190, 45, 82))
local insertButton = makeButton("InsertButton", "INSERT GENERATED SCRIPTS INTO STUDIO", 6, Color3.fromRGB(55, 105, 170))
insertButton.Visible = false

local statusLabel = makeLabel("Status", "Ready. Enter a game idea to begin.", 42, 7, Color3.fromRGB(170, 210, 185), 12)
statusLabel.TextYAlignment = Enum.TextYAlignment.Top

local resultScroll = Instance.new("ScrollingFrame")
resultScroll.Name = "GeneratedFiles"
resultScroll.Size = UDim2.new(1, 0, 1, -330)
resultScroll.BackgroundColor3 = Color3.fromRGB(23, 26, 37)
resultScroll.BorderSizePixel = 0
resultScroll.ScrollBarThickness = 6
resultScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
resultScroll.LayoutOrder = 8
resultScroll.Parent = root

local resultPadding = Instance.new("UIPadding")
resultPadding.PaddingTop = UDim.new(0, 8)
resultPadding.PaddingBottom = UDim.new(0, 8)
resultPadding.PaddingLeft = UDim.new(0, 8)
resultPadding.PaddingRight = UDim.new(0, 8)
resultPadding.Parent = resultScroll

local resultLayout = Instance.new("UIListLayout")
resultLayout.Padding = UDim.new(0, 7)
resultLayout.SortOrder = Enum.SortOrder.LayoutOrder
resultLayout.Parent = resultScroll

resultLayout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()
	resultScroll.CanvasSize = UDim2.new(0, 0, 0, resultLayout.AbsoluteContentSize.Y + 16)
end)

local latestFiles = nil
local latestProjectName = "MadaraAI_Project"
local busy = false

local function setStatus(message, isError)
	statusLabel.Text = message
	statusLabel.TextColor3 = isError and Color3.fromRGB(255, 130, 140) or Color3.fromRGB(170, 210, 185)
end

local function clearResults()
	for _, child in ipairs(resultScroll:GetChildren()) do
		if child:IsA("TextLabel") then
			child:Destroy()
		end
	end
end

local function addFileCard(file)
	local card = Instance.new("TextLabel")
	card.Name = "File_" .. tostring(file.path)
	card.Size = UDim2.new(1, -4, 0, 48)
	card.BackgroundColor3 = Color3.fromRGB(34, 39, 54)
	card.BorderSizePixel = 0
	card.Font = Enum.Font.Code
	card.TextSize = 11
	card.TextColor3 = Color3.fromRGB(225, 230, 242)
	card.TextWrapped = true
	card.TextXAlignment = Enum.TextXAlignment.Left
	card.TextYAlignment = Enum.TextYAlignment.Center
	card.Text = "  " .. tostring(file.kind) .. "  |  " .. tostring(file.path)
	card.Parent = resultScroll
end

local function safeName(value)
	local name = tostring(value or "GeneratedScript")
	name = name:gsub("%.server%.lua$", ""):gsub("%.client%.lua$", ""):gsub("%.lua$", "")
	name = name:gsub("[^%w_%- ]", ""):gsub("^%s+", ""):gsub("%s+$", "")
	if name == "" then
		name = "GeneratedScript"
	end
	return name
end

local function getServiceAndRelativePath(path, kind)
	local clean = tostring(path or ""):gsub("\\", "/")
	local segments = {}
	for segment in string.gmatch(clean, "[^/]+") do
		table.insert(segments, segment)
	end

	local serviceNames = {
		ServerScriptService = true,
		ReplicatedStorage = true,
		StarterPlayer = true,
		StarterGui = true,
		Workspace = true,
		Lighting = true,
		ServerStorage = true,
	}

	local serviceName = nil
	if #segments > 1 and serviceNames[segments[1]] then
		serviceName = table.remove(segments, 1)
	end

	if not serviceName then
		if kind == "client" then
			serviceName = "StarterPlayer"
		elseif kind == "module" then
			serviceName = "ReplicatedStorage"
		else
			serviceName = "ServerScriptService"
		end
	end

	if #segments == 0 then
		table.insert(segments, "GeneratedScript.lua")
	end

	return serviceName, segments
end

local function uniqueFolder(parent, baseName)
	local name = safeName(baseName)
	local candidate = name
	local suffix = 2
	while parent:FindFirstChild(candidate) do
		candidate = name .. "_" .. suffix
		suffix += 1
	end
	local folder = Instance.new("Folder")
	folder.Name = candidate
	folder.Parent = parent
	return folder
end

local function createGeneratedScript(file, projectFolderName)
	if type(file) ~= "table" or type(file.code) ~= "string" or type(file.path) ~= "string" then
		return false, "Invalid generated file"
	end
	if file.kind == "readme" then
		return false, "readme"
	end

	local serviceName, segments = getServiceAndRelativePath(file.path, file.kind)
	local service = game:GetService(serviceName)
	local projectFolder = service:FindFirstChild(projectFolderName)
	if not projectFolder then
		projectFolder = Instance.new("Folder")
		projectFolder.Name = projectFolderName
		projectFolder.Parent = service
	end

	for index = 1, #segments - 1 do
		local folderName = safeName(segments[index])
		local folder = projectFolder:FindFirstChild(folderName)
		if not folder then
			folder = Instance.new("Folder")
			folder.Name = folderName
			folder.Parent = projectFolder
		end
		projectFolder = folder
	end

	local fileName = segments[#segments]
	local className = "Script"
	if file.kind == "client" or fileName:match("%.client%.lua$") then
		className = "LocalScript"
	elseif file.kind == "module" then
		className = "ModuleScript"
	end

	local scriptName = safeName(fileName)
	local scriptObject = Instance.new(className)
	scriptObject.Name = scriptName
	local ok, err = pcall(function()
		scriptObject.Source = file.code
	end)
	if not ok then
		scriptObject:Destroy()
		return false, "Could not write script source: " .. tostring(err)
	end
	scriptObject.Parent = projectFolder
	return true
end

local function generate()
	if busy then
		return
	end
	local prompt = promptBox.Text:gsub("^%s+", ""):gsub("%s+$", "")
	local mode = modeBox.Text:gsub("^%s+", ""):gsub("%s+$", "")
	if prompt == "" then
		setStatus("Write your game idea first.", true)
		return
	end
	if #prompt > 5000 then
		setStatus("Your idea is too long. Maximum 5000 characters.", true)
		return
	end

	busy = true
	generateButton.Text = "GENERATING..."
	generateButton.Active = false
	insertButton.Visible = false
	latestFiles = nil
	clearResults()
	setStatus("Connecting to Madara AI agents. This can take a little while...", false)

	local ok, response = pcall(function()
		return HttpService:RequestAsync({
			Url = API_URL,
			Method = "POST",
			Headers = { ["Content-Type"] = "application/json" },
			Body = HttpService:JSONEncode({
				prompt = prompt,
				mode = mode,
			}),
			Timeout = 55,
		})
	end)

	if not ok then
		setStatus("Connection failed: " .. tostring(response) .. ". Check the plugin's web permission and try again.", true)
	elseif not response.Success then
		local message = "Madara AI returned HTTP " .. tostring(response.StatusCode)
		local decodedOk, decoded = pcall(function()
			return HttpService:JSONDecode(response.Body)
		end)
		if decodedOk and type(decoded) == "table" and type(decoded.error) == "string" then
			message = decoded.error
		end
		setStatus(message, true)
	else
		local decodedOk, data = pcall(function()
			return HttpService:JSONDecode(response.Body)
		end)
		if not decodedOk or type(data) ~= "table" then
			setStatus("Madara AI returned an unreadable response.", true)
		elseif type(data.files) ~= "table" then
			setStatus("The response did not contain any project files.", true)
		else
			latestFiles = data.files
			latestProjectName = safeName(data.projectName or "MadaraAI_Project")
			local validCount = 0
			for _, file in ipairs(latestFiles) do
				if type(file) == "table" and type(file.code) == "string" and type(file.path) == "string" and file.kind ~= "readme" then
					validCount += 1
					addFileCard(file)
				end
			end
			setStatus("Generated " .. validCount .. " script(s). Review the file list, then insert them into your place.", false)
			insertButton.Visible = validCount > 0
		end
	end

	busy = false
	generateButton.Text = "GENERATE WITH MADARA AI"
	generateButton.Active = true
end

local function insertScripts()
	if busy or type(latestFiles) ~= "table" then
		return
	end
	busy = true
	insertButton.Text = "INSERTING..."
	insertButton.Active = false

	local folderName = latestProjectName .. "_" .. os.date("%H%M%S")
	local inserted = 0
	local skipped = 0
	local failures = {}

	for _, file in ipairs(latestFiles) do
		local ok, result = pcall(createGeneratedScript, file, folderName)
		if ok and result == true then
			inserted += 1
		elseif not ok then
			table.insert(failures, tostring(result))
		else
			skipped += 1
		end
	end

	if #failures > 0 then
		setStatus("Inserted " .. inserted .. " script(s); " .. #failures .. " failed. First error: " .. failures[1], true)
	else
		setStatus("Inserted " .. inserted .. " script(s) into Studio. Read each script before testing or publishing.", false)
	end
	if skipped > 0 then
		setStatus(statusLabel.Text .. " Skipped " .. skipped .. " readme/unsupported file(s).", false)
	end

	busy = false
	insertButton.Text = "INSERT GENERATED SCRIPTS INTO STUDIO"
	insertButton.Active = true
end

generateButton.Activated:Connect(generate)
insertButton.Activated:Connect(insertScripts)
toggleButton.Click:Connect(function()
	widget.Enabled = not widget.Enabled
end)

plugin.Unloading:Connect(function()
	widget:Destroy()
end)
