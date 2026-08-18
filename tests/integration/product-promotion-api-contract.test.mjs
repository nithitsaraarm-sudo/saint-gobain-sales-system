import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUsers } from '../fixtures/api-contract-data.mjs';
import { createRouterContext, ok } from '../helpers/api-contract-harness.mjs';

function createProductPromotionRouter(actor) {
  return createRouterContext(actor, {
    getProducts() {
      return ok([]);
    },
    getProductPromotions(payload) {
      return ok({ groups: [], summary: { totalPromotions: 0 }, actor: payload.currentUser.userId });
    },
    getPromotions() {
      return ok([]);
    },
    saveProduct(payload) {
      return ok({ productId: payload.productId || 'PROD-SYN-001' });
    },
    savePromotion(payload) {
      return ok({ promotionId: payload.promotionId || 'PROMO-SYN-001', actor: payload.currentUser.userId });
    }
  });
}

test('Product/Promotion read routes preserve current production RBAC', () => {
  const sales = createProductPromotionRouter(apiUsers.salesNE03);
  assert.equal(sales.api('products', { sessionToken: 'synthetic' }).ok, true);
  assert.equal(sales.api('getPromotions', { sessionToken: 'synthetic' }).ok, true);
  assert.equal(sales.api('getProductPromotions', { sessionToken: 'synthetic' }).ok, true);

  const viewer = createProductPromotionRouter(apiUsers.viewer);
  assert.equal(viewer.api('products', { sessionToken: 'synthetic' }).code, 'FORBIDDEN');
  assert.equal(viewer.api('getPromotions', { sessionToken: 'synthetic' }).code, 'FORBIDDEN');
});

test('Product/Promotion master write routes deny SALES and PC direct API bypass attempts', () => {
  [apiUsers.salesNE03, apiUsers.pc].forEach(actor => {
    const ctx = createProductPromotionRouter(actor);
    const product = ctx.api('saveProduct', { sessionToken: 'synthetic', productId: 'PROD-SYN-001' });
    const promotion = ctx.api('savePromotion', { sessionToken: 'synthetic', promotionId: 'PROMO-SYN-001' });

    assert.equal(product.ok, false, `${actor.role} product write should fail`);
    assert.equal(product.code, 'FORBIDDEN');
    assert.equal(promotion.ok, false, `${actor.role} promotion write should fail`);
    assert.equal(promotion.code, 'FORBIDDEN');
    assert.equal(ctx.__calls.saveProduct || 0, 0);
    assert.equal(ctx.__calls.savePromotion || 0, 0);
  });
});

test('Product/Promotion master write routes remain available to ADMIN and SUPER_ADMIN', () => {
  [apiUsers.adminNE03, apiUsers.superAdmin].forEach(actor => {
    const ctx = createProductPromotionRouter(actor);
    const product = ctx.api('saveProduct', { sessionToken: 'synthetic', productId: 'PROD-SYN-001' });
    const promotion = ctx.api('savePromotion', { sessionToken: 'synthetic', promotionId: 'PROMO-SYN-001' });

    assert.equal(product.ok, true, `${actor.role} product write should pass`);
    assert.equal(product.data.productId, 'PROD-SYN-001');
    assert.equal(promotion.ok, true, `${actor.role} promotion write should pass`);
    assert.equal(promotion.data.promotionId, 'PROMO-SYN-001');
  });
});
