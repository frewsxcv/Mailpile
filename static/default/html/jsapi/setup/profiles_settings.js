

/* Setup - Profiles - View */
var ProfilesSettingsView = Backbone.View.extend({
  initialize: function() {
    Backbone.Validation.bind(this);
		this.render();
  },
  render: function() {
    return this;
  },
  events: {
    "blur #input-setup-profile-email"     : "actionCheckEmailMagic",
    "blur #input-setup-profile-pass"      : "actionCheckAuth",
    "mouseover #btn-setup-profile-save"   : "actionCheckAuth",
    "click #btn-setup-connection-check"   : "actionCheckAuth",
    "change #input-setup-profile-route_id": "actionHandleRoute",
    "click .btn-setup-profile-edit-route" : "actionEditRoute",
    "click #btn-setup-profile-save"       : "processSettings"
  },
  show: function() {
    $('#setup-profiles-list').removeClass('bounceInUp').addClass('bounceOutLeft');
    var new_model = this.model.attributes;
    Mailpile.API.setup_profiles_get({}, function(result) {
      var add_data = _.extend(new_model, {routes: result.result.routes, provider: ''});
      $('#setup').html(_.template($('#template-setup-profiles-add').html(), add_data));
    });
  },
  showEdit: function(id) {
    $('#setup-profiles-list').removeClass('bounceInUp').addClass('bounceOutUp');

    // Load Data & Add to Collection
    Mailpile.API.setup_profiles_get({}, function(result) {
      var profile = result.result.profiles[id];
      if (profile !== undefined) {
        var provider = SetupMagic.providers[profile.email.replace(/.*@/, "")];
        console.log(provider);
        _.extend(profile, { id: id, action: 'Edit', provider: provider });
        var edit_data = _.extend(profile, {routes: result.result.routes});
        $('#setup').html(_.template($('#template-setup-profiles-add').html(), edit_data));
      }
    });
  },
  showGmailWarning: function(message) {
    if (this.model.attributes.warning !== 'used' || message !== 'warning') {
      this.model.set({warning: 'used'});

      // Load Content
      $('#modal-full').html($('#modal-gmail-auth-' + message).html());
  
      // Instantiate
      $('#modal-full').modal({
        backdrop: true,
        keyboard: true,
        show: true,
        remote: false
      });

      // Empty Password & Add Testing Link
      setTimeout(function() {
        $('#input-setup-profile-pass').val('');
        $('#validation-pass').find('.check-auth')
          .removeClass('color-08-green color-12-red')
          .html('<a href="#" id="btn-setup-connection-check" class="setup-check-connection"><span class="icon-help"></span> {{_("Test Connection")}}</a>');
      }, 1000);
    }
  },
  actionCheckEmailMagic: function(e) {
    var domain = $(e.target).val().replace(/.*@/, "");
    var provider = SetupMagic.providers[domain];
    console.log(provider);
    if (provider) {
      $('#input-setup-profile-pass').data('provider', provider).attr('data-provider', provider);
      $('#validation-pass').fadeIn('fast', function(){
        $('#input-setup-profile-pass').attr("tabindex", -1).focus();
      });

      // Show Gmail Warning
      if (provider === 'gmail') {
        ProfilesSettingsView.showGmailWarning('warning');
      }
    }
  },
  actionCheckAuth: function(e) {

    // Prevent from incorrectly firing
    if ($('#input-setup-profile-email').val() && $('#input-setup-profile-pass').val() && SetupMagic.status == 'error') {

      // Disable Save Button
      $('#btn-setup-profile-save').attr("disabled", true);

      // Status UI Message
      $('#validation-pass').find('.check-auth')
        .removeClass('color-12-red color-08-green')
        .html('<em>{{_("Testing Credentials")}}</em> <img src="/static/css/select2-spinner.gif">');

      var provider = $('#input-setup-profile-pass').data('provider');
      var presets = SetupMagic.presets[provider];
      var sending_data = _.extend(presets.sending, {
        username: $('#input-setup-profile-email').val(),
        password: $('#input-setup-profile-pass').val()
      });

      Mailpile.API.setup_test_route_post(sending_data, function(result) {

        // Renable Save Profile
        $('#btn-setup-profile-save').removeAttr('disabled');

        // Yay, Add Magic & Success
        SetupMagic.status = result.status;
        if (result.status ==  'success') {
          $('#validation-pass').find('.check-auth')
            .removeClass('color-12-red')
            .addClass('color-08-green')
            .html('<span class="icon-checkmark"></span> {{_("Successfully Connected")}}');

          // Add Sending
          SetupMagic.provider = provider;
          sending_data['_section'] = 'routes.' + SetupMagic.random_id;

          Mailpile.API.settings_set_post(sending_data, function(result) {
            $('#input-setup-profile-route_id').prepend('<option value="' + SetupMagic.random_id + '">' + sending_data.name + '</option>').val(SetupMagic.random_id);
            $('#validation-route').fadeIn();
          });
        }
        else if (result.status == 'error' && provider == 'gmail') {

        $('#validation-pass').find('.check-auth')
          .removeClass('color-08-green')
          .addClass('color-12-red')
          .html('<span class="icon-x"></span> {{_("Error Connecting")}}');

          ProfilesSettingsView.showGmailWarning('error');
        }
        else if (result.status == 'error') {
          $('#validation-pass').find('.check-auth')
            .removeClass('color-08-green')
            .addClass('color-12-red')
            .html('<span class="icon-x"></span> {{_("Error Connecting")}}');
        }
      });
    }
  },
  actionHandleRoute: function(e) {

    e.preventDefault();
    var route_id = $('#input-setup-profile-route_id').val();

    // Show Add Route Form
    if (route_id == 'new') {
      console.log('ROUTE CHANGE: go add new route');

      var domain = $('#input-setup-profile-email').val().replace(/.*@/, "");
      SendingView.model.set({
        id: Math.random().toString(36).substring(2),
        complete: 'profiles',
        name: domain,
        username: $('#input-setup-profile-email').val(),
        password: $('#input-setup-profile-pass').val(),
        host: 'smtp.' + domain
      });

      // Show Sending Form
      $('#setup-sending-list').removeClass('bounceInUp').addClass('bounceOutLeft');
      this.$el.html(_.template($("#template-setup-sending-settings").html(), SendingView.model.attributes));
    }
    // Update route to Profile
    else if (route_id && route_id !== 'new' && $('#input-setup-profile-id').val() !== 'new') {
      console.log('ROUTE CHANGE: update profile vcard');

      var vcard_data = {
        rid: $('#input-setup-profile-id').val(),
        name: 'x-mailpile-profile-route',
        value: route_id
      };
      
      console.log(vcard_data);

      Mailpile.API.vcards_addlines_post(vcard_data, function(result) {
        if (result.status == 'success') {
          console.log('ROUTE CHANGE: route_id was updated');
        }
      });

      $('#input-setup-profile-route_id').addClass('half-bottom');
      $('#setup-profile-edit-route').removeClass('hide');
    }
    // Route for New Profile 
    else if (route_id && route_id !== 'new' && $('#input-setup-profile-id').val() !== 'new') {
      console.log('ROUTE CHANGE: will be added to new profile');
    } else if (route_id === '') {
      console.log('ROUTE CHANGE: no route id, not updating');
      $('#input-setup-profile-route_id').removeClass('half-bottom');
      $('#setup-profile-edit-route').addClass('hide');
    }
  },
  actionEditRoute: function(e) {
    e.preventDefault();
    var route_id = $('#input-setup-profile-route_id').find('option:selected').val();
    Backbone.history.navigate('#sending/'+route_id, true);
  },
  processSettings: function(e) {

    e.preventDefault();
    if ($(e.target).data('id') == 'new') {

      // Update Model
      var profile_data = $('#form-setup-profile-settings').serializeObject();
      this.model.set(profile_data);
  
      // Validate & Process
      if (!this.model.validate()) {
        Mailpile.API.setup_profiles_post(profile_data, function(result) {

          // Update State
          StateModel.fetch();

          // Reset Model & Navigate
          ProfilesView.model.set({name: '', email: '', pass: '', note: ''});
          Backbone.history.navigate('#profiles', true);

          // Add Setup Magic (Source)
          if (SetupMagic.status == 'success') {
            SetupMagic.processAdd({
              username: profile_data.email,
              password: profile_data.pass
            });
          }
        });
      }
    } else {

      console.log('UPDATE NAME & EMAIL');
      var profile_id = $('#input-setup-profile-id').val();
      _.each($('.profile-update'), function(item, key) {
        var name = $(item).data('vcard_name');
        var value = $(item).val();
        var vcard_data = { rid: profile_id, name: name, value: value };
        console.log(vcard_data);

        Mailpile.API.vcards_addlines_post(vcard_data, function(result) {
          console.log(result);
        });
      });
    }
  },
});