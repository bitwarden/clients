

/* this ALWAYS GENERATED file contains the definitions for the interfaces */


 /* File created by MIDL compiler version 8.01.0628 */
/* @@MIDL_FILE_HEADING(  ) */



/* verify that the <rpcndr.h> version is high enough to compile this file*/
#ifndef __REQUIRED_RPCNDR_H_VERSION__
#define __REQUIRED_RPCNDR_H_VERSION__ 501
#endif

/* verify that the <rpcsal.h> version is high enough to compile this file*/
#ifndef __REQUIRED_RPCSAL_H_VERSION__
#define __REQUIRED_RPCSAL_H_VERSION__ 100
#endif

#include "rpc.h"
#include "rpcndr.h"

#ifndef __RPCNDR_H_VERSION__
#error this stub requires an updated version of <rpcndr.h>
#endif /* __RPCNDR_H_VERSION__ */

#ifndef COM_NO_WINDOWS_H
#include "windows.h"
#include "ole2.h"
#endif /*COM_NO_WINDOWS_H*/

#ifndef __pluginauthenticator_h__
#define __pluginauthenticator_h__

#if defined(_MSC_VER) && (_MSC_VER >= 1020)
#pragma once
#endif

#ifndef DECLSPEC_XFGVIRT
#if defined(_CONTROL_FLOW_GUARD_XFG)
#define DECLSPEC_XFGVIRT(base, func) __declspec(xfg_virtual(base, func))
#else
#define DECLSPEC_XFGVIRT(base, func)
#endif
#endif

/* Forward Declarations */ 

#ifndef __IPluginAuthenticator_FWD_DEFINED__
#define __IPluginAuthenticator_FWD_DEFINED__
typedef interface IPluginAuthenticator IPluginAuthenticator;

#endif 	/* __IPluginAuthenticator_FWD_DEFINED__ */


/* header files for imported files */
#include "oaidl.h"

#ifdef __cplusplus
extern "C"{
#endif 


/* interface __MIDL_itf_pluginauthenticator_0000_0000 */
/* [local] */ 

typedef 
enum _WEBAUTHN_PLUGIN_REQUEST_TYPE
    {
        WEBAUTHN_PLUGIN_REQUEST_TYPE_CTAP2_CBOR	= 0x1
    } 	WEBAUTHN_PLUGIN_REQUEST_TYPE;

typedef struct _WEBAUTHN_PLUGIN_OPERATION_REQUEST
    {
    HWND hWnd;
    GUID transactionId;
    DWORD cbRequestSignature;
    /* [size_is] */ byte *pbRequestSignature;
    WEBAUTHN_PLUGIN_REQUEST_TYPE requestType;
    DWORD cbEncodedRequest;
    /* [size_is] */ byte *pbEncodedRequest;
    } 	WEBAUTHN_PLUGIN_OPERATION_REQUEST;

typedef struct _WEBAUTHN_PLUGIN_OPERATION_REQUEST *PWEBAUTHN_PLUGIN_OPERATION_REQUEST;

typedef const WEBAUTHN_PLUGIN_OPERATION_REQUEST *PCWEBAUTHN_PLUGIN_OPERATION_REQUEST;

typedef struct _WEBAUTHN_PLUGIN_OPERATION_RESPONSE
    {
    DWORD cbEncodedResponse;
    /* [size_is] */ byte *pbEncodedResponse;
    } 	WEBAUTHN_PLUGIN_OPERATION_RESPONSE;

typedef struct _WEBAUTHN_PLUGIN_OPERATION_RESPONSE *PWEBAUTHN_PLUGIN_OPERATION_RESPONSE;

typedef const WEBAUTHN_PLUGIN_OPERATION_RESPONSE *PCWEBAUTHN_PLUGIN_OPERATION_RESPONSE;

typedef struct _WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST
    {
    GUID transactionId;
    DWORD cbRequestSignature;
    /* [size_is] */ byte *pbRequestSignature;
    } 	WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST;

typedef struct _WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST *PWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST;

typedef const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST *PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST;

typedef 
enum _PLUGIN_LOCK_STATUS
    {
        PluginLocked	= 0,
        PluginUnlocked	= ( PluginLocked + 1 ) 
    } 	PLUGIN_LOCK_STATUS;



extern RPC_IF_HANDLE __MIDL_itf_pluginauthenticator_0000_0000_v0_0_c_ifspec;
extern RPC_IF_HANDLE __MIDL_itf_pluginauthenticator_0000_0000_v0_0_s_ifspec;

#ifndef __IPluginAuthenticator_INTERFACE_DEFINED__
#define __IPluginAuthenticator_INTERFACE_DEFINED__

/* interface IPluginAuthenticator */
/* [ref][version][uuid][object] */ 


EXTERN_C const IID IID_IPluginAuthenticator;

#if defined(__cplusplus) && !defined(CINTERFACE)
    
    MIDL_INTERFACE("d26bcf6f-b54c-43ff-9f06-d5bf148625f7")
    IPluginAuthenticator : public IUnknown
    {
    public:
        virtual HRESULT STDMETHODCALLTYPE MakeCredential( 
            /* [in] */ __RPC__in PCWEBAUTHN_PLUGIN_OPERATION_REQUEST request,
            /* [retval][out] */ __RPC__out PWEBAUTHN_PLUGIN_OPERATION_RESPONSE response) = 0;
        
        virtual HRESULT STDMETHODCALLTYPE GetAssertion( 
            /* [in] */ __RPC__in PCWEBAUTHN_PLUGIN_OPERATION_REQUEST request,
            /* [retval][out] */ __RPC__out PWEBAUTHN_PLUGIN_OPERATION_RESPONSE response) = 0;
        
        virtual HRESULT STDMETHODCALLTYPE CancelOperation( 
            /* [in] */ __RPC__in PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST request) = 0;
        
        virtual HRESULT STDMETHODCALLTYPE GetLockStatus( 
            /* [retval][out] */ __RPC__out PLUGIN_LOCK_STATUS *lockStatus) = 0;
        
    };
    
    
#else 	/* C style interface */

    typedef struct IPluginAuthenticatorVtbl
    {
        BEGIN_INTERFACE
        
        DECLSPEC_XFGVIRT(IUnknown, QueryInterface)
        HRESULT ( STDMETHODCALLTYPE *QueryInterface )( 
            __RPC__in IPluginAuthenticator * This,
            /* [in] */ __RPC__in REFIID riid,
            /* [annotation][iid_is][out] */ 
            _COM_Outptr_  void **ppvObject);
        
        DECLSPEC_XFGVIRT(IUnknown, AddRef)
        ULONG ( STDMETHODCALLTYPE *AddRef )( 
            __RPC__in IPluginAuthenticator * This);
        
        DECLSPEC_XFGVIRT(IUnknown, Release)
        ULONG ( STDMETHODCALLTYPE *Release )( 
            __RPC__in IPluginAuthenticator * This);
        
        DECLSPEC_XFGVIRT(IPluginAuthenticator, MakeCredential)
        HRESULT ( STDMETHODCALLTYPE *MakeCredential )( 
            __RPC__in IPluginAuthenticator * This,
            /* [in] */ __RPC__in PCWEBAUTHN_PLUGIN_OPERATION_REQUEST request,
            /* [retval][out] */ __RPC__out PWEBAUTHN_PLUGIN_OPERATION_RESPONSE response);
        
        DECLSPEC_XFGVIRT(IPluginAuthenticator, GetAssertion)
        HRESULT ( STDMETHODCALLTYPE *GetAssertion )( 
            __RPC__in IPluginAuthenticator * This,
            /* [in] */ __RPC__in PCWEBAUTHN_PLUGIN_OPERATION_REQUEST request,
            /* [retval][out] */ __RPC__out PWEBAUTHN_PLUGIN_OPERATION_RESPONSE response);
        
        DECLSPEC_XFGVIRT(IPluginAuthenticator, CancelOperation)
        HRESULT ( STDMETHODCALLTYPE *CancelOperation )( 
            __RPC__in IPluginAuthenticator * This,
            /* [in] */ __RPC__in PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST request);
        
        DECLSPEC_XFGVIRT(IPluginAuthenticator, GetLockStatus)
        HRESULT ( STDMETHODCALLTYPE *GetLockStatus )( 
            __RPC__in IPluginAuthenticator * This,
            /* [retval][out] */ __RPC__out PLUGIN_LOCK_STATUS *lockStatus);
        
        END_INTERFACE
    } IPluginAuthenticatorVtbl;

    interface IPluginAuthenticator
    {
        CONST_VTBL struct IPluginAuthenticatorVtbl *lpVtbl;
    };

    

#ifdef COBJMACROS


#define IPluginAuthenticator_QueryInterface(This,riid,ppvObject)	\
    ( (This)->lpVtbl -> QueryInterface(This,riid,ppvObject) ) 

#define IPluginAuthenticator_AddRef(This)	\
    ( (This)->lpVtbl -> AddRef(This) ) 

#define IPluginAuthenticator_Release(This)	\
    ( (This)->lpVtbl -> Release(This) ) 


#define IPluginAuthenticator_MakeCredential(This,request,response)	\
    ( (This)->lpVtbl -> MakeCredential(This,request,response) ) 

#define IPluginAuthenticator_GetAssertion(This,request,response)	\
    ( (This)->lpVtbl -> GetAssertion(This,request,response) ) 

#define IPluginAuthenticator_CancelOperation(This,request)	\
    ( (This)->lpVtbl -> CancelOperation(This,request) ) 

#define IPluginAuthenticator_GetLockStatus(This,lockStatus)	\
    ( (This)->lpVtbl -> GetLockStatus(This,lockStatus) ) 

#endif /* COBJMACROS */


#endif 	/* C style interface */




#endif 	/* __IPluginAuthenticator_INTERFACE_DEFINED__ */


/* Additional Prototypes for ALL interfaces */

unsigned long             __RPC_USER  HWND_UserSize(     __RPC__in unsigned long *, unsigned long            , __RPC__in HWND * ); 
unsigned char * __RPC_USER  HWND_UserMarshal(  __RPC__in unsigned long *, __RPC__inout_xcount(0) unsigned char *, __RPC__in HWND * ); 
unsigned char * __RPC_USER  HWND_UserUnmarshal(__RPC__in unsigned long *, __RPC__in_xcount(0) unsigned char *, __RPC__out HWND * ); 
void                      __RPC_USER  HWND_UserFree(     __RPC__in unsigned long *, __RPC__in HWND * ); 

unsigned long             __RPC_USER  HWND_UserSize64(     __RPC__in unsigned long *, unsigned long            , __RPC__in HWND * ); 
unsigned char * __RPC_USER  HWND_UserMarshal64(  __RPC__in unsigned long *, __RPC__inout_xcount(0) unsigned char *, __RPC__in HWND * ); 
unsigned char * __RPC_USER  HWND_UserUnmarshal64(__RPC__in unsigned long *, __RPC__in_xcount(0) unsigned char *, __RPC__out HWND * ); 
void                      __RPC_USER  HWND_UserFree64(     __RPC__in unsigned long *, __RPC__in HWND * ); 

/* end of Additional Prototypes */

#ifdef __cplusplus
}
#endif

#endif


