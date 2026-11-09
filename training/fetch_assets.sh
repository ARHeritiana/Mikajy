#!/usr/bin/env bash
# Downloads the training data used for the recogniser (MNIST + OFL handwriting fonts) into $MIKAJY_ASSETS (default /tmp).
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"   # the script's own folder (the script cd's into the fonts folder below)
A=${MIKAJY_ASSETS:-/tmp}
mkdir -p "$A/fonts" && cd "$A/fonts"
curl -sfL -o "$A/mnist.pkl.gz" https://github.com/mnielsen/neural-networks-and-deep-learning/raw/master/data/mnist.pkl.gz
for p in patrickhand/PatrickHand-Regular indieflower/IndieFlower-Regular kalam/Kalam-Regular shadowsintolight/ShadowsIntoLight-Regular gochihand/GochiHand-Regular architectsdaughter/ArchitectsDaughter-Regular reeniebeanie/ReenieBeanie handlee/Handlee-Regular schoolbell/Schoolbell-Regular gloriahallelujah/GloriaHallelujah neucha/Neucha-Regular comingsoon/ComingSoon-Regular justanotherhand/JustAnotherHand-Regular coveredbyyourgrace/CoveredByYourGrace walterturncoat/WalterTurncoat-Regular shortstack/ShortStack-Regular zeyada/Zeyada sueellenfrancisco/SueEllenFrancisco-Regular overtherainbow/OvertheRainbow mansalva/Mansalva-Regular gaegu/Gaegu-Regular caveatbrush/CaveatBrush-Regular delius/Delius-Regular itim/Itim-Regular sriracha/Sriracha-Regular annieuseyourtelescope/AnnieUseYourTelescope-Regular rancho/Rancho-Regular waitingforthesunrise/WaitingfortheSunrise loveyalikeasister/LoveYaLikeASister nothingyoucoulddo/NothingYouCouldDo pangolin/Pangolin-Regular mali/Mali-Regular chilanka/Chilanka-Regular; do
  n=$(basename $p); curl -sfL -m 30 -o $n.ttf "https://github.com/google/fonts/raw/main/ofl/$p.ttf" || rm -f $n.ttf
done
curl -sfL -o "$A/caveat.ttf" "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf"
ls "$A/fonts" | wc -l

# More handwriting fonts (school cursive and print styles), listed in fonts_extra.txt: "directory/file" under google/fonts ofl/.
grep -v '^#' "$HERE/fonts_extra.txt" | while IFS=/ read -r d f; do
  [ -f "$A/fonts/$f" ] || curl -sfL -m 90 -o "$A/fonts/$f" "https://github.com/google/fonts/raw/main/ofl/$d/$(printf %s "$f" | sed 's/\[/%5B/g; s/\]/%5D/g')" || rm -f "$A/fonts/$f"
done
ls "$A/fonts" | wc -l
