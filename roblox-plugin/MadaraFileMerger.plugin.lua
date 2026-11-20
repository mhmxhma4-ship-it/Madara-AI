--!strict
-- Madara AI Binary Model Merger
-- Imports a real binary .rbxm file into the currently open Roblox place.
-- The open place can be a .rbxl or .rbxlx file.

local StudioService = game:GetService("StudioService")
local SerializationService = game:GetService("SerializationService")
local ChangeHistoryService = game:GetService("ChangeHistoryService")

local toolbar = plugin:CreateToolbar("Madara AI")
local button = toolbar:CreateButton(
	"MergeRobloxModel",
	"Import a binary .rbxm model into the currently open place",
	""
)
button.ClickableWhenViewportHidden = true

local MAX_BYTES = 100 * 1024 * 1024
local busy = false

local function report(message: string)
	print("[Madara AI Merger] " .. message)
end

button.Click:Connect(function()
	if busy then
		return
	end
	busy = true

	local ok, result = pcall(function()
		local file = StudioService:PromptImportFileAsync({"rbxm"})
		if not file then
			return "Import cancelled. No changes were made."
		end
		if not file:IsA("File") then
			error("Roblox Studio did not return a valid File object.")
		end
		local importedFile = file :: File
		if importedFile.Size <= 0 or importedFile.Size > MAX_BYTES then
			error("The .rbxm file must be between 1 byte and 100 MB.")
		end

		local binaryContents = importedFile:GetBinaryContents()
		if type(binaryContents) ~= "string" or #binaryContents == 0 then
			error("The selected .rbxm file is empty or could not be read.")
		end

		local modelInstances = SerializationService:DeserializeInstancesAsync(buffer.fromstring(binaryContents))
		if type(modelInstances) ~= "table" or #modelInstances == 0 then
			error("No Roblox objects were found in this .rbxm file.")
		end

		local recordingId = ChangeHistoryService:TryBeginRecording(
			"MadaraAIBinaryModelMerge",
			"Merge binary Roblox model"
		)
		if not recordingId then
			error("Roblox Studio could not start an Undo recording. No objects were inserted.")
		end

		local inserted = {}
		local parentOk, parentError = pcall(function()
			for _, instance in ipairs(modelInstances) do
				instance.Parent = workspace
				table.insert(inserted, instance)
			end
		end)

		if not parentOk then
			for _, instance in ipairs(inserted) do
				pcall(function()
					instance:Destroy()
				end)
			end
			ChangeHistoryService:FinishRecording(recordingId, Enum.FinishRecordingOperation.Cancel)
			error("Could not insert the model. Changes were rolled back: " .. tostring(parentError))
		end

		ChangeHistoryService:FinishRecording(recordingId, Enum.FinishRecordingOperation.Commit)
		return "SUCCESS: inserted " .. tostring(#inserted) .. " root object(s) from " .. importedFile.Name .. " into Workspace. Use Ctrl+Z to undo, then save the place."
	end)

	if ok then
		report(tostring(result))
	else
		warn("[Madara AI Merger] " .. tostring(result))
	end

	busy = false
end)

report("Ready. Open your base .rbxl/.rbxlx place, then click the toolbar button and choose a .rbxm model.")
