import flow from "lodash.flow";
import { CreateRootCAVerifier, RootCertificatesList, ICaStore, RootCertificates } from "./types";
import { parsePemFile } from "./parsePemFile";
import { createPKICertificate, isRootCertificate, findDistinguishedName, isValidityPeriodCorrect } from "./utils";
import { createChainVerifier } from "./createChainVerifier";

export const createRootCaVerifier: CreateRootCAVerifier = (rootCertificates, hasDomainValidation = true) => {
  const caStore = flow(determineTypeOfGivenArgument, createCAStore)(rootCertificates) as ICaStore;
  return createChainVerifier(caStore, hasDomainValidation);
};

/**
 * Determine if 'rootCertificates' is either a pathname to '*.pem' file or an array of certificates
 */
export function determineTypeOfGivenArgument(rootCertificates: RootCertificates): RootCertificatesList {
  if (typeof rootCertificates === "string") {
    return parsePemFile(rootCertificates);
  } else if (Array.isArray(rootCertificates)) {
    return rootCertificates;
  }

  throw new Error("You have to provide a path to '*.pem' file or an array of root CA");
}

/**
 * Create root CA store dictionary: { ['* commonName * organizationName * organizationalUnitName *']: PKICertificate }
 */
export function createCAStore(rootCertificatesList: RootCertificatesList): ICaStore {
  try {
    return rootCertificatesList.reduce((dictionary: ICaStore, pem) => {
      const pkiCert = createPKICertificate(pem);
      const isCorrectValidityPeriod = isValidityPeriodCorrect(pkiCert);
      const pemFirstSymbols = pem.slice(27, 47).trim();

      if (!isCorrectValidityPeriod) {
        console.error(
          `Given root certificate '${pemFirstSymbols}...' has an invalid validity period (either it has expired or is not valid yet)`,
        );
      }

      if (!isRootCertificate(pkiCert)) {
        throw new Error(`Certificate '${pemFirstSymbols}...' is not a root CA`);
      }

      const dn = findDistinguishedName(pkiCert, "subject");
      dictionary[dn] = pkiCert;

      return dictionary;
    }, {});
  } catch (err) {
    console.error("An error occurred during creation of CA store. Please check correctness of your root certificates.");
    throw err;
  }
}
