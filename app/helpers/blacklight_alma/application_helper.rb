require 'uri'

module BlacklightAlma
  module ApplicationHelper

    # Returns a URL to be used in an iframe
    # See https://developers.exlibrisgroup.com/alma/integrations/discovery/fulfillment_services
    #
    # @param document [SolrDocument]
    # @param service_type [String] viewit, getit
    # @param language [String] language code
    # @param view [Int] integer code for view to use. From documentation:
    # "In order to support multiple views, an institution can define multiple views
    # in Alma, with different CSS. This is configured in Alma under
    # Gerenal configuration - Delivery System Skins."
    # @return [String] url
    def alma_app_fulfillment_url(document, service_type: nil, language: nil, view: nil)
      mms_id = document.id
      domain = Rails.configuration.alma[:delivery_domain] || 'alma.delivery.domain.example.com'
      institution_code = Rails.configuration.alma[:institution_code] || 'INSTITUTION_CODE'
      service_type ||= alma_service_type_for_fulfillment_url(document)

      query = {
          rfr_id: 'info:sid/primo.exlibrisgroup.com',
          svc_dat: service_type,
          'rft.mms_id': mms_id,
      }
      rft_dat_value = [language.present? ? "language=#{language}" : nil,
                       view.present? ? "view=#{view}" : nil].compact.join(',')
      query['rft_dat'] = rft_dat_value if rft_dat_value.present?
      query['u.ignore_date_coverage'] = 'true' if service_type == 'viewit'

      URI::HTTPS.build(
        host: domain,
        path: "/view/uresolver/#{institution_code}/openurl",
        query: query.to_query).to_s
    end

    # Returns the right service type string depending on whether
    # the document (bib record) is electronic or not.
    # TODO: This doesn't account for fact that a bib record may have both
    # physical and electronic holdings. Need to figure out how to handle that:
    # the view creating the iframe may need to check holdings/availability first,
    # which isn't ideal since it's an additional request.
    # @param document [SolrDocument]
    # @return [String] viewit, getit
    def alma_service_type_for_fulfillment_url(document)
      if (Array.wrap(document['format']).first || '').downcase == 'electronic'
        'viewit'
      else
        'getit'
      end
    end

  end
end
