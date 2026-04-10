# CPQ Image Rendering (Layered PNG)

## Goal
Render a composited bike preview from selected CPQ options by stacking transparent PNG layers.

## Data path
1. Bike-builder derives selected options:
   - `featureLabel`
   - `optionLabel`
   - `optionValue`
2. Calls `POST /api/cpq/image-layers`.
3. Server resolves mappings from `cpq_image_management`.
4. Returns layers with slot + pictureLink.
5. Client renders `<img>` elements absolutely stacked in preview box.

## Matching rule
Exact DB match on:
- `feature_label = featureLabel`
- `option_label = optionLabel`
- `option_value = optionValue`
- `is_active = true`

## Slot semantics
- `picture_link_1` = bottom layer
- `picture_link_2` above slot 1
- `picture_link_3` above slot 2
- `picture_link_4` top layer

Blank links are ignored.

## Update triggers
Image resolution reruns after:
- initial configuration load
- each successful Configure update
- any change in selected-option lookup signature

## Debug outputs
API also returns:
- `matchedSelections`
- `unmatchedSelections`

UI surfaces counts in debug mode for quick mapping gap analysis.
