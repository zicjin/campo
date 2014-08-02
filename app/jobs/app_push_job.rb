class AppPushJob
  @queue = 'apppush'

  def self.perform(push_id)
    push = Apppush.find push_id
    device = Appid.find push.appid
    if device.type == DeviceType::iOS
      push_to_ios(push)
    elseif device.type == DeviceType::Android
      push_to_android(push)
    end
  end

  def self.push_to_ios(push)

  end

  def self.push_to_android(push)

  end
end
