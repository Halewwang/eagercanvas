export const WEDDING_3X3_MODE_OPTIONS = [
  {
    key: 'product_showcase',
    label: 'Product Showcase',
    description: 'Keep the floral product as the hero across all nine frames.'
  },
  {
    key: 'scene_expansion',
    label: 'Scene Expansion',
    description: 'Expand into people, setting, and wedding storytelling.'
  }
]

export const WEDDING_3X3_DEFAULT_MODE = 'product_showcase'

export const WEDDING_3X3_OPTIONS = {
  style: [
    'French Village',
    'French Chic',
    'French Elegance'
  ],
  season: [
    'All Year',
    'Early Spring',
    'Spring',
    'Early Summer',
    'Midsummer',
    'Late Summer',
    'Early Autumn',
    'Autumn',
    'Late Autumn',
    'Early Winter'
  ],
  color_family: [
    'White & Green',
    'Blush',
    'Lavender',
    'Sage Purple',
    'Power Pink',
    'Powder Pink',
    'Earth Brown',
    'Maroon',
    'Berries'
  ],
  main_color: [
    'Lavender Mist',
    'Soft Ivory',
    'Powder Pink',
    'Blush Rose',
    'Sage Smoke',
    'Earth Brown',
    'Maroon Berry',
    'Champagne White'
  ],
  mood_primary: [
    'Relaxed',
    'Refined',
    'Romantic',
    'Graceful',
    'Poetic',
    'Serene',
    'Sunlit',
    'Welcoming'
  ],
  mood_tags: [
    'Airy',
    'Sunlit',
    'Rustic Charm',
    'Soft Luxury',
    'Ceremony in Slow Rhythm',
    'Understated',
    'Design-driven',
    'Editorial'
  ],
  product_type: [
    'bouquet',
    'arch',
    'floor_arrangement',
    'table_centerpiece'
  ],
  greenery_coverage: [
    '≤20%',
    '20%-60%',
    '≥60%'
  ],
  greenery_character: [
    'Fresh Light Green',
    'Muted Soft Green',
    'Deep Green',
    'Olive Green',
    'Dark Olive Green',
    'Autumn Mixed Green',
    'Ivy Leather Leaf Texture',
    'Pine Green',
    'Yellowing Willow Leaf',
    'Fruit-Heavy Dark Green',
    'Purple-Green Gradient'
  ],
  venue_type: [
    'Manor',
    'Backyard',
    'Courtyard',
    'Glass Conservatory',
    'Club Lounge',
    'Pottery Atrium',
    'Rattan Gallery',
    'Lavender Manor',
    'Olive Grove',
    'Lemon Tree Courtyard',
    'Vineyard Farmyard',
    'Stone Wine Cellar',
    'Oak-Beam Barn',
    'Concrete Column Hall',
    'Hotel',
    'Banquet Hall'
  ],
  wall_surface: [
    'Textured Off-White Panels',
    'Beige Stone Wall Panels',
    'Off-White Stone Wall Panels',
    'Smooth Off-White Wainscoting',
    'Chalky Plaster',
    'Straw Paint',
    'Roman Stone Decorative Panel',
    'Gray White Brick Wall'
  ],
  ground_surface: [
    'Lime Stone',
    'Gravel',
    'Washed Stone',
    'Wooden Floor',
    'Concrete Floor',
    'Red Square Brick',
    'Solid Color Square Brick',
    'Terracotta Tiles',
    'Marble Floor Tiles'
  ],
  props: [
    'Rattan Armchairs',
    'Wrought Iron Candelabra',
    'Crinkled Linen Tablecloths',
    'Majolica Ceramic Plates',
    'Braided Jute Runners',
    'Dried Floral Wreaths',
    'Ribbon-Tied Chair Backs',
    "Baby's Breath Glass Cloches",
    'Marble Place Cards',
    'Champagne Bucket Stands',
    'Pressed Flower Menus',
    'Fairy Light Backdrops',
    'Olive Branch Arches',
    'Lavender Mist Machines',
    'Silk Parasol Clusters',
    'Linen Draped Gazebos',
    'Potted Lemon Tree Groves',
    'Copper Birdcage Candelabras',
    'Rattan Ball Fairy Lights',
    'Hand-Painted Wind Socks',
    'Floating Floral Glass Columns',
    'Shutter Photo Displays',
    'Woven Ceremony Bells',
    'Champagne Tower Vine Stand',
    'Dried Flower Fringe Curtains',
    'Ceramic Plate Mural Wall',
    'Rosemary Aisle Markers',
    'Lace Fan Covers',
    'Tin Bucket Flower Chillers',
    'Rope Swing Chairs',
    'Pressed Flower Glass Votives'
  ],
  fabric_material: [
    'Cotton',
    'Linen',
    'Cotton-Linen',
    'Chiffon',
    'Silk',
    'Charmeuse',
    'Diamond Linen'
  ],
  decor_material: [
    'Terracotta',
    'Wrought Iron',
    'Walnut Wood',
    'Brass',
    'Leather',
    'Glass',
    'Pearl',
    'Gilded Metal',
    'Ceramic',
    'Marble',
    'Jute',
    'Stone',
    'Lime Stone'
  ],
  scene_type: [
    'Before Ceremony',
    'Ceremony',
    'Reception',
    'Detail Narrative'
  ],
  relationship_mode: [
    'Bride Alone',
    'Bride and Groom',
    'Bridal Party',
    'Couple with Guests',
    'Guest Interaction'
  ],
  story_action: [
    'Holding hands before the ceremony',
    'Adjusting the veil in a quiet pause',
    'Standing beneath the floral arch',
    'Walking past the floral aisle',
    'Sharing a quiet glance',
    'A quiet toast at the reception table',
    'Touching bouquet ribbons softly',
    'Leaning toward each other beside the floral installation'
  ],
  environment_flavor: [
    'Olive Grove',
    'Sun-Drenched Courtyard',
    'Soft Marble Quietness',
    'Lavender Air',
    'Slow Ceremony Rhythm',
    'Poetic Candlelight',
    'Refined Indoor Glow',
    'Garden Humidity'
  ]
}

export const WEDDING_3X3_LIMITS = {
  mood_tags: 3,
  greenery_character: 2,
  props: 5,
  fabric_material: 3,
  decor_material: 3,
  environment_flavor: 2
}
