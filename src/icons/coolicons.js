import { h } from 'vue'
import { Icon } from '@iconify/vue'

import addPlus from '@iconify-icons/ci/add-plus'
import image from '@iconify-icons/ci/image'
import arrowUpRight from '@iconify-icons/ci/arrow-up-right-md'
import refresh from '@iconify-icons/ci/refresh'
import fileDocument from '@iconify-icons/ci/file-document'
import folderOpen from '@iconify-icons/ci/folder-open'
import moreHorizontal from '@iconify-icons/ci/more-horizontal'
import edit from '@iconify-icons/ci/edit'
import copy from '@iconify-icons/ci/copy'
import settings from '@iconify-icons/ci/settings'
import trashFull from '@iconify-icons/ci/trash-full'
import chevronLeft from '@iconify-icons/ci/chevron-left'
import chevronDown from '@iconify-icons/ci/chevron-down'
import text from '@iconify-icons/ci/text'
import playCircle from '@iconify-icons/ci/play-circle'
import swatchesPalette from '@iconify-icons/ci/swatches-palette'
import bookmark from '@iconify-icons/ci/bookmark'
import undo from '@iconify-icons/ci/undo'
import redo from '@iconify-icons/ci/redo'
import grid from '@iconify-icons/ci/grid'
import compass from '@iconify-icons/ci/compass'
import minus from '@iconify-icons/ci/minus'
import download from '@iconify-icons/ci/download'
import gridBig from '@iconify-icons/ci/grid-big'
import chatCircle from '@iconify-icons/ci/chat-circle'
import closeMd from '@iconify-icons/ci/close-md'
import bookOpen from '@iconify-icons/ci/book-open'
import userCircle from '@iconify-icons/ci/user-circle'
import shoppingCart from '@iconify-icons/ci/shopping-cart-01'
import bulb from '@iconify-icons/ci/bulb'
import expand from '@iconify-icons/ci/expand'
import closeCircle from '@iconify-icons/ci/close-circle'
import show from '@iconify-icons/ci/show'
import editPencil from '@iconify-icons/ci/edit-pencil-01'
import color from '@iconify-icons/ci/color'
import chevronRight from '@iconify-icons/ci/chevron-right'

const wrap = (iconData) => ({
  name: 'CoolIconAdapter',
  render() {
    return h(Icon, { icon: iconData })
  }
})

export const AddOutline = wrap(addPlus)
export const ImageOutline = wrap(image)
export const SendOutline = wrap(arrowUpRight)
export const RefreshOutline = wrap(refresh)
export const DocumentOutline = wrap(fileDocument)
export const FolderOutline = wrap(folderOpen)
export const EllipsisHorizontalOutline = wrap(moreHorizontal)
export const CreateOutline = wrap(edit)
export const CopyOutline = wrap(copy)
export const SettingsOutline = wrap(settings)
export const TrashOutline = wrap(trashFull)

export const ChevronBackOutline = wrap(chevronLeft)
export const ChevronDownOutline = wrap(chevronDown)
export const TextOutline = wrap(text)
export const VideocamOutline = wrap(playCircle)
export const ColorPaletteOutline = wrap(swatchesPalette)
export const BookmarkOutline = wrap(bookmark)
export const ArrowUndoOutline = wrap(undo)
export const ArrowRedoOutline = wrap(redo)
export const GridOutline = wrap(grid)
export const LocateOutline = wrap(compass)
export const RemoveOutline = wrap(minus)
export const DownloadOutline = wrap(download)
export const AppsOutline = wrap(gridBig)
export const ChatbubbleOutline = wrap(chatCircle)

export const CloseOutline = wrap(closeMd)
export const FolderOpenOutline = wrap(folderOpen)
export const BookOutline = wrap(bookOpen)
export const PersonOutline = wrap(userCircle)
export const CartOutline = wrap(shoppingCart)

export const SparklesOutline = wrap(bulb)
export const ExpandOutline = wrap(expand)
export const CloseCircleOutline = wrap(closeCircle)
export const EyeOutline = wrap(show)
export const BrushOutline = wrap(editPencil)
export const ColorWandOutline = wrap(color)
export const ChevronForwardOutline = wrap(chevronRight)
