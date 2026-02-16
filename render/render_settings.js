// various settings for rendering, user-modifiable
// order matters: later rules override earlier rules
var title_mappings = [
{pattern : /Google Chrome|Firefox|Brave|Microsoft Edge/i, mapto : 'Browser'},
{pattern : /Visual Studio Code| - Code/i, mapto : 'VSCode'},
{pattern : /Cursor/i, mapto : 'Cursor'},
{pattern : /PyCharm|IntelliJ|CLion|Rider/i, mapto : 'JetBrains'},
{pattern : /Fusion 360|Autodesk Fusion|Fusion360/i, mapto : 'CAD / Design'},
{pattern : /Windows PowerShell|Command Prompt|Windows Terminal|pwsh|cmd\.exe/i, mapto : 'Terminal'},
{pattern : /Jupyter|Notebook|Colab/i, mapto : 'Notebook'},
{pattern : /GitHub|Stack Overflow|Read the Docs|Documentation/i, mapto : 'Dev Research'},
{pattern : /Google Docs|Google Sheets|Notion|OneNote|PowerPoint|Excel|Word/i, mapto : 'Planning'},
{pattern : /File Explorer|explorer\.exe/i, mapto : 'File Explorer'},
{pattern : /Snipping Tool|Settings|Control Panel/i, mapto : 'Utility'},
{pattern : /JDownloader/i, mapto : 'Downloads'},
{pattern : /OBS/i, mapto : 'OBS'},
{pattern : /YouTube|Spotify|Music/i, mapto : 'Media'},
{pattern : /Dispatch|Naruto|Steam|Epic Games|Riot Client|Valorant|Dota|League of Legends|CS2|Counter-Strike|Genshin|Roblox|Minecraft/i, mapto : 'Games'},
{pattern : /Facebook|Instagram|Twitter|X \(|Discord|Telegram|WhatsApp/i, mapto : 'Social'},
{pattern : /ChatGPT|Claude|Gemini|Perplexity/i, mapto : 'AI Research'},
{pattern : /\.(py|js|ts|tsx|jsx|html|css|cpp|h|md)/i, mapto : 'VSCode Coding'},
{pattern : /Task Switching/i, mapto : 'Task Switching'},
{pattern : /__IDLE__/, mapto : 'Idle'},
{pattern : /__LOCKEDSCREEN/, mapto : 'Locked Screen'},
];

function mapwin(w) {
  var n = title_mappings.length;
  var mapped_title = 'MISC';
  for(var i=0;i<n;i++) {
    var patmap = title_mappings[i];
    if(patmap.pattern.test(w)) {
      mapped_title = patmap.mapto;
    }
  }
  return mapped_title;
}

// group titles together in the barcode view
var display_groups = [];
display_groups.push(["VSCode Coding", "VSCode", "Cursor", "JetBrains", "Terminal", "Notebook", "Dev Research", "AI Research", "CAD / Design"]);
display_groups.push(["Planning", "Browser", "File Explorer", "Utility", "Downloads"]);
display_groups.push(["OBS", "Media", "Social", "Games"]);
display_groups.push(["Task Switching", "Idle", "Locked Screen", "MISC"]);

// list of titles that classify as "hacking"
var hacking_titles = ["VSCode Coding", "VSCode", "Cursor", "JetBrains", "Terminal", "Notebook", "Dev Research", "AI Research"];
// Productive categories that may not involve heavy typing.
// These are counted by focused active-window time in computeHackingStats().
var passive_hacking_titles = ["CAD / Design"];
var draw_hacking = true;
var draw_notes = true;
var draw_coffee = false;

// optional aliases for compatibility with any newer custom scripts
var titleMappings = title_mappings;
var mapWin = mapwin;
var displayGroups = display_groups;
var hackingTitles = hacking_titles;
var passiveHackingTitles = passive_hacking_titles;
var drawHacking = draw_hacking;
var drawNotes = draw_notes;
var drawCoffee = draw_coffee;
  
