# September 2016
- Added Royalty II, Fireworks, Fireworks II, Lucky 7 and Strata to the gallery
- Improved robustness of Hankin inference algorithm

# August 2016
- Website now serves under HTTPS and is gzipped
- Added scale, panning and zooming to strip preview pane
- Added support for exact numbers in sliders

## Bug fixes
- Issue where pattern validation was giving false positives
- Issue where custom pattern parameters were not wrapping around

# July 2016
- Updated documentation with optimization feature
- Updated documentation with video
- Better color picker with more options and support for custom colors
- More validation around patterns that would fail to trace or lie outside the tile

# June 2016
- Added SVG strip preview feature
- Moved strip generation parameters into strip preview modal
- Improved cross-browser compatibility
- Added thick SVG rendering feature (beta)

# April 2016
## Bug fixes
- Issue where unnecessary creases were generated when two line segments were parallel

# March 2016
- Added dynamic scaling to pattern edit pane (handling large tiles that would not fit with scale=1)
- Updated gallery with Hibiscus, Royalty and Altair

# February 2016
- Added optimization feature

# January 2016
- Split up custom shape modal into Basic and Advanced options
- Moved strip generation from panel into sidebar
- Moved unstable features (e.g. cropping, planarity) to beta status
- Made strip generation bar sortable and assignable
- Improved explanation for Planar Tilings switch
- Improved PNG export functionality (variable resolutions available)
- Improved image loading (use of sprites)
- Improved tile rotation (from center of group, not center of tile)
- Improved UI of custom patterns degrees of freedom
- Reorganized gallery by difficulty
- Added canvas control buttons (Zoom to Fit and Reset Zoom Level)
- Added ability to unassign strip colors

## Bug fixes
- Issue where strip color assignments didn't persist through changes in extension length
- Issue where color assignments didn't persist through saves and view toggles
- Issue where strips would be recomputed even when no changes were made to the tiles

# December 2015
- Redesigned entire website
- Renamed app from 'Wallpaper Studio' to 'Sliceform Studio'
- Changed serialization extension to `.slfm`
- Rehauled tutorial content
- Added documentation section
- Added ability to download tile design as png or svg
- Added input validation to custom tile creation
- Added loading icon on page load
- Added ability to change display canvas height by dragging the bottom edge
- Persists shape options through saving and loading
- Removed 'Edit Pattern' button, moved to individual buttons beside each tile

## Bug fixes
- Issue where tiles in the palette could be accidentally joined

# November 2015
- Improved performance of saving and loading large patterns
- Added pattern cropping as a beta feature
- Moved 'Add Tile' into a modal
- Added basic hotkey support

## Bug fixes
- Issue where non-spatial edge joins didn't carry over to trace canvas
- Issue where custom patterns were not initializing properly on load
- Issue where strip lengths drop to 0 after cropping
- Issue where strips with cycles were not built correctly

# October 2015
- Added ability to save and load patterns as `.wlpr` files

## Bug fixes
- Issue with maintaining state with multiple custom patterns on the same tile