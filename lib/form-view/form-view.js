import debug from 'debug';
import o from 'component-dom';
import spin from 'component-spin';
import t from 't-component';
import * as validate from '../validate/validate.js';
import autosubmit from '../autosubmit/autosubmit.js';
import autovalidate from '../autovalidate/autovalidate.js';
import isMobile from '../is-mobile/is-mobile.js';
import View from '../view/view.js';

let log = debug('democracyos:form-view');

export default class FormView extends View {

  /**
   * Base Form View
   *
   * @return {FormView} `FormView` instance.
   * @api public
   */

  constructor (template, options = {}) {
    if (!arguments.length) return;
    super(template, options);
    this.autovalidate('form[autovalidate]');
    this.autosubmit('form[autosubmit]');
    this.on('insert', this.bound('oninsert'));
    this.messages();
  }

  oninsert () {
    this.on('request', this.bound('loading'));
    this.on('response', this.bound('unloading'));
    this.on('response', this.bound('response'));
  }

  removeMessages () {
    this.find('li.msg').remove();
  }

  errors (msg) {
    this.messages(msg, 'error');
  }

  success (msg) {
    this.messages(msg, 'success');
  }

  messages (messages, type, fade) {
    this.removeMessages();
    messages = messages || [];
    if ('string' === typeof messages) {
      messages = [messages];
    }

    let ul = this.find('.form-messages');
    if (!ul.length) {
      ul = o('<ul class="form-messages">');
      this.find('form').prepend(ul);
    }

    messages.forEach((msg) => {
      let li = o(document.createElement('li'));
      li.addClass('msg');
      if (type) li.addClass(type);
      if (fade) li.addClass('fade');
      li.html(msg);
      ul.append(li);
    });
  }

  disable () {
    this.disabled = true;
    validate.disable(this.el);
  }

  enable () {
    this.disabled = false;
    validate.enable(this.el);
  }

  spin () {
    let but = this.find('button');
    if (!but.length)
      return;
    let self = this;
    this.spinTimer = setTimeout(() => {
      self.spinner = spin(but[0], {size: 20}).light();
      but.addClass("spin")
    }, 500);
  }

  unspin () {
    clearTimeout(this.spinTimer);
    if (!this.spinner) return;
    this.find('button').removeClass('spin');
    this.spinner.remove();
    this.spinner = null;
  }

  loading () {
    let self = this;
    this.disable();
    this.messageTimer = setTimeout(() => {
      self.messages(t('form.please-wait'), 'sending');
      self.spin();
      self.find('a.cancel').addClass('enabled')
    }, 1000);
  }

  unloading () {
    clearTimeout(this.messageTimer);
    this.removeMessages();
    this.unspin();
    this.enable();
    this.find('a.cancel').removeClass('enabled')
  }

  response (err, res) {
    if (err) {
      this.emit('error', err);
      return this.errors([err]);
    };

    if (!res.ok) {
      var err = JSON.parse(res.text);
      this.emit('error', err);
      return this.errors([err.error]);
    };

    if (res.body && res.body.error) {
      // Not emitting error on purpose. Fixes #610
      // Request was faulty but not an unexpected error.
      return this.errors([res.body.error]);
    };

    this.emit('success', res);
  }

  destroy () {
    clearTimeout(this.messageTimer);
    this.unspin();
  }

  field (name) {
    let strfind = 'input[name="' + name + '"], textarea[name="' + name + '"]';
    return this.find(strfind);
  }

  get (name) {
    let el = this.field(name);
    let chk = 'checkbox' == el.attr('type');
    return chk ? el.attr('checked') ? true : false : el.val();
  }

  set (field, val) {
    this.field(field).val(val);
  }

  placeholder (field, val) {
    this.field(field).attr('placeholder', val);
  }

  focus (field) {
    if (!isMobile) this.field(field).focus();
  }

  valid (name, print, fn) {
    fn = 'function' == typeof fn ? fn : print;
    print = 'boolean' == typeof print ? print : true;
    let fields = autovalidate.validators(this.field(name));
    let val = this.get(name);
    validate.field(name, fields.validations, val, this.el[0], print, fn);
  };

  reset () {
    this.find('form')[0].reset();
  };

  autovalidate (selector) {
    let self = this;
    let el = this.find(selector);
    if (!el.length) return;
    this.autovalidating = true;
    el.on('submit', (e) => {
      e.preventDefault();
      self.emit('submit');
      autovalidate(el, (data) => self.emit('valid', data));
    });
  }

  autosubmit (selector) {
    let self = this;
    let el = this.find(selector);
    if (!el.length) return;
    let submit = () => {
      self.emit('request');
      let postserialize = self.postserialize ? self.postserialize.bind(self) : null;
      let formRequest = autosubmit(el, ((err, res) => self.emit('response', err, res)), postserialize);
      formRequest.on('abort', self.onCancel.bind(self));
    };

    el.on('submit', () => self.removeMessages());

    if (this.autovalidating) {
      this.on('valid', submit);
    } else {
      el.on('submit', (e) => {
        e.preventDefault();
        self.emit('submit');
        submit();
      });
    }
  }

  onCancel (ev) {
    if (ev) ev.preventDefault();
    this.emit('cancel');
  }

}
