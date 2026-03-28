export type CardSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export type CardRank =
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export type CardFace = `${CardSuit}_${CardRank}`;

export type CardImageName =
  | 'card_back'
  | 'card_empty'
  | 'card_joker_black'
  | 'card_joker_red'
  | `card_${CardFace}`;

export type CardImagePath = `/images/cards/${CardImageName}.png`;

export type StandardCardImageName = `card_${CardFace}`;
export type StandardCardImagePath = `/images/cards/${StandardCardImageName}.png`;

export type PlayingCard = {
  suit: CardSuit;
  rank: CardRank;
  face: CardFace;
  imageName: StandardCardImageName;
  imagePath: StandardCardImagePath;
};

export const cardSuits: readonly CardSuit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
export const cardRanks: readonly CardRank[] = [
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

export const allPlayingCards: readonly PlayingCard[] = cardSuits.flatMap((suit) =>
  cardRanks.map((rank) => {
    const face = `${suit}_${rank}` as CardFace;
    const imageName = `card_${face}` as StandardCardImageName;
    const imagePath = `/images/cards/${imageName}.png` as StandardCardImagePath;
    return { suit, rank, face, imageName, imagePath };
  })
);

export const allCardImageNames: readonly CardImageName[] = [
  'card_back',
  'card_empty',
  'card_joker_black',
  'card_joker_red',
  ...allPlayingCards.map((card) => card.imageName),
];

export const allCardImagePaths: readonly CardImagePath[] = allCardImageNames.map(
  (name) => `/images/cards/${name}.png` as CardImagePath
);

// preload the images at startup.
let cardImagesPreloaded = false;
export function preloadCardImages(): void {
  if (cardImagesPreloaded) {
    return;
  }

  cardImagesPreloaded = true;

  if (typeof Image === 'undefined') {
    return;
  }

  allCardImagePaths.forEach((src) => {
    const image = new Image();
    image.src = src;
  });
}
