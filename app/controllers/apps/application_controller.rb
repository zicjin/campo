class Apps::ApplicationController < ApplicationController
  layout 'app'

  private

  def login_required
    unless login?
      redirect_to "app://login"
    end
  end
end
