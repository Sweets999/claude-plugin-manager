# cpm hero demo — the run/focus workflow.
# Record with:  vhs scripts/demo/hero.tape   (run from the repo root)

Output docs/demo.gif

Set Shell "bash"
Set FontSize 20
Set Width 1200
Set Height 760
Set Padding 24
Set Theme "Catppuccin Mocha"
Set TypingSpeed 55ms
Set PlaybackSpeed 1.0

# --- hidden setup: build sandbox, point cpm at it -------------------------
Hide
Type "source scripts/demo/demo-env.sh" Enter
Sleep 500ms
Show

# --- where am I? a bloated context, no profile in sight ------------------
Type "cpm status" Sleep 600ms Enter
Sleep 2.5s

# --- what profiles do I have? -------------------------------------------
Type "cpm ls" Sleep 600ms Enter
Sleep 2.5s

# --- preview the trim before committing ----------------------------------
Type "cpm diff focus" Sleep 600ms Enter
Sleep 3s

# --- launch a lean session, no global change, no restart ----------------
Type "cpm focus" Sleep 600ms Enter
Sleep 3s

Sleep 1.5s
