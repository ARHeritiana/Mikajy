#!/usr/bin/env python3
"""Resizes the original Mikajy logo, preserving its existing artwork."""
from pathlib import Path
from PIL import Image
here=Path(__file__).resolve().parent
original=Image.open(here/'logo-512.png').convert('RGB')
original.resize((1024,1024),Image.Resampling.LANCZOS).save(here/'logo-1024.png',optimize=True)
original.resize((192,192),Image.Resampling.LANCZOS).save(here.parent/'android/res/drawable/icon.png',optimize=True)
print('launcher icon updated')
