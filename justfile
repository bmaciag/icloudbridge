set shell := ["zsh", "-c"]

release args='':
	python3 scripts/build_release.py {{args}}

release-skip:
	just release "--skip-dmg"
