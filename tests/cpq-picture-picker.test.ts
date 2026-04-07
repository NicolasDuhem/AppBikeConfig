import test from 'node:test';
import assert from 'node:assert/strict';
import { canPreviewPicture, canShowPickPictureAction, hasLinkedPicture } from '../lib/cpq-picture-picker.ts';

test('canShowPickPictureAction follows feature flag', () => {
  assert.equal(canShowPickPictureAction(true), true);
  assert.equal(canShowPickPictureAction(false), false);
});

test('hasLinkedPicture detects existing asset URL', () => {
  assert.equal(hasLinkedPicture({ picture_asset_url: 'https://dam.brompton.com/asset/123' }), true);
  assert.equal(hasLinkedPicture({ picture_asset_url: '' }), false);
  assert.equal(hasLinkedPicture({ picture_asset_url: null }), false);
});

test('canPreviewPicture validates basic http/https URL shape', () => {
  assert.equal(canPreviewPicture('https://dam.brompton.com/picture.png'), true);
  assert.equal(canPreviewPicture('http://dam.brompton.com/picture.png'), true);
  assert.equal(canPreviewPicture('dam.brompton.com/picture.png'), false);
});
