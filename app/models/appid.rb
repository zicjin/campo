# class Appid
#   include Mongoid::Document
#   field :idstring
#   field :type, type: Integer, default: 1
#   field :app_ver
#   field :os_ver
#   field :device_info
#   field :freeze, type: Boolean
#   field :last_login, type: DateTime
#   attr_readonly :idstring

#   validates :type, presence: true
#   validates :idstring, presence: true, uniqueness: { case_sensitive: true }
# end