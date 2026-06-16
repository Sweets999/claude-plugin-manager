# cpm persistent-swap demo — `use` then `undo`.
# Record with:  vhs scripts/demo/use-undo.tape   (run from the repo root)

Output docs/demo-use-undo.gif

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 760
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms
Set PlaybackSpeed 1.0

# --- hidden setup --------------------------------------------------------
Hide
Type "source scripts/demo/demo-env.sh" Enter
Sleep 500ms
Show

# --- make a profile the persistent global default ------------------------
Type "cpm use web -y" Sleep 600ms Enter
Sleep 3s

# --- confirm: status now matches the profile -----------------------------
Type "cpm status" Sleep 600ms Enter
Sleep 2.5s

# --- one keystroke back to where we were ---------------------------------
Type "cpm undo" Sleep 600ms Enter
Sleep 3s

Sleep 1.5s
