/**
 * @license
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Snackbar} from '@material/mwc-snackbar';
import {html, TemplateResult} from 'lit-html';

import {Fake, fixture, ieSafeKeyboardEvent, rafPromise, TestFixture} from '../../../../test/src/util/helpers';

interface SnackBarProps {
  timeoutMs: number;
  closeOnEscape: boolean;
  labelText: string;
  actionElement: TemplateResult;
  dismissElement: TemplateResult;
}

const defaultSnackBar = html`<mwc-snackbar></mwc-snackbar>`;

const snackBar = (propsInit: Partial<SnackBarProps>) => {
  return html`
    <mwc-snackbar
      .timeoutMs=${propsInit.timeoutMs ?? -1}
      .closeOnEscape=${propsInit.closeOnEscape === true}
      .labelText=${propsInit.labelText ?? ''}>
      ${propsInit.actionElement ?? html``}
      ${propsInit.dismissElement ?? html``}
    </mwc-snackbar>
  `;
};

const findLabelText = (element: Element) => {
  // Note that label text can either be in the label's textContent, or in its
  // ::before pseudo-element content (set via an attribute), for ARIA reasons.
  const label = element.shadowRoot!.querySelector('.mdc-snackbar__label')!;
  return label.getAttribute('data-mdc-snackbar-label-text') ||
      label.textContent;
};

suite('mwc-snackbar', () => {
  let fixt: TestFixture;
  let element: Snackbar;
  let originalSetTimeout: typeof window.setTimeout;

  setup(() => {
    originalSetTimeout = window.setTimeout;
    (window as any).setTimeout = (fn: Function) => {
      fn();
      return -1;
    };
  });

  teardown(() => {
    window.setTimeout = originalSetTimeout;
    element.parentNode!.removeChild(element);
  });

  suite('basic', () => {
    setup(async () => {
      fixt = await fixture(defaultSnackBar);
      element = fixt.root.querySelector('mwc-snackbar')!;
      await element.updateComplete;
    });

    test('initializes as an mwc-snackbar', () => {
      assert.instanceOf(element, Snackbar);
      assert.isFalse(element.isOpen);
      assert.equal(element.timeoutMs, 5000);
      assert.isFalse(element.closeOnEscape);
      assert.equal(element.labelText, '');
      assert.isFalse(element.stacked);
      assert.isFalse(element.leading);
    });
  });

  suite('open/close', () => {
    setup(async () => {
      fixt = await fixture(snackBar({timeoutMs: -1}));
      element = fixt.root.querySelector('mwc-snackbar')!;
      await element.updateComplete;
    });

    test('`open()` opens snack bar', async () => {
      const openedHandler = new Fake<[], void>();
      const openingHandler = new Fake<[], void>();
      element.addEventListener('MDCSnackbar:opened', openedHandler.handler);
      element.addEventListener('MDCSnackbar:opening', openingHandler.handler);
      assert.equal(element.isOpen, false);
      element.open();
      await element.updateComplete;
      assert.isTrue(openingHandler.called);
      await rafPromise();
      assert.isTrue(element.isOpen);
      assert.isTrue(openedHandler.called);
    });

    test('`close()` closes snack bar', async () => {
      const closedHandler = new Fake<[], void>();
      element.addEventListener('MDCSnackbar:closed', closedHandler.handler);
      element.open();
      await element.updateComplete;
      await rafPromise();
      element.close();
      assert.isFalse(element.isOpen);
      assert.isTrue(closedHandler.called);
    });
  });

  suite('labelText', () => {
    setup(async () => {
      fixt = await fixture(snackBar({labelText: 'foo'}));
      element = fixt.root.querySelector('mwc-snackbar')!;
      await element.updateComplete;
    });

    test('set label text after opening', async () => {
      element.open();
      await element.updateComplete;
      assert.equal(findLabelText(element), 'foo');

      element.labelText = 'bar';
      await element.updateComplete;
      assert.equal(findLabelText(element), 'bar');

      element.labelText = 'baz';
      await element.updateComplete;
      assert.equal(findLabelText(element), 'baz');
    });
  });

  suite('dismiss', () => {
    setup(async () => {
      fixt = await fixture(
          snackBar({dismissElement: html`<span slot="dismiss">test</span>`}));
      element = fixt.root.querySelector('mwc-snackbar')!;
      await element.updateComplete;
    });

    test('closes when dismissed', async () => {
      const close = element.querySelector<HTMLElement>('[slot="dismiss"]')!;
      const closedHandler = new Fake<[Event], void>();
      element.addEventListener('MDCSnackbar:closed', closedHandler.handler);
      element.open();
      await element.updateComplete;
      close.click();
      assert.isFalse(element.isOpen);
      const ev = closedHandler.calls[0].args[0] as CustomEvent;
      assert.equal(ev.detail.reason, 'dismiss');
    });
  });

  suite('action', () => {
    setup(async () => {
      fixt = await fixture(
          snackBar({actionElement: html`<span slot="action">test</span>`}));
      element = fixt.root.querySelector('mwc-snackbar')!;
      await element.updateComplete;
    });

    test('closes when actioned', async () => {
      const action = element.querySelector<HTMLElement>('[slot="action"]')!;
      const closedHandler = new Fake<[Event], void>();
      element.addEventListener('MDCSnackbar:closed', closedHandler.handler);
      element.open();
      await element.updateComplete;
      action.click();
      assert.isFalse(element.isOpen);
      const ev = closedHandler.calls[0].args[0] as CustomEvent;
      assert.equal(ev.detail.reason, 'action');
    });
  });

  suite('`closeOnEscape`', () => {
    setup(async () => {
      fixt = await fixture(snackBar({closeOnEscape: true}));
      element = fixt.root.querySelector('mwc-snackbar')!;
      await element.updateComplete;
    });

    test('does not close when unset and esc is pressed', async () => {
      element.closeOnEscape = false;
      element.open();
      await element.updateComplete;
      await rafPromise();
      const bar = element.shadowRoot!.querySelector('.mdc-snackbar')!;
      assert.equal(element.isOpen, true);

      // escape keycode
      const escEv = ieSafeKeyboardEvent('keydown', 27);
      bar.dispatchEvent(escEv);

      await element.updateComplete;
      assert.equal(element.isOpen, true);
    });

    test('closes when set and esc is pressed', async () => {
      element.open();
      await element.updateComplete;
      await rafPromise();
      const bar = element.shadowRoot!.querySelector('.mdc-snackbar')!;
      assert.equal(element.isOpen, true);

      // escape keycode
      const escEv = ieSafeKeyboardEvent('keydown', 27);
      bar.dispatchEvent(escEv);

      await element.updateComplete;
      assert.equal(element.isOpen, false);
    });
  });
});
