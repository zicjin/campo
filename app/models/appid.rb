class Appid
  include Mongoid::Document
  field :idstring
  field :type, type: Integer
  field :app_ver
  field :os_ver
  field :dvice_info
  field :freeze, type: Boolean
  field :last_login, type: DateTime
  attr_readonly :idstring
end